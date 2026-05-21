import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  InscricaoFormState,
  normalizeForm,
  validateAll,
} from "@/lib/inscricao-schema";
import { getInscriptionsStatus } from "@/lib/inscriptions";
import { deleteDraft } from "@/lib/draft-store";

export const runtime = "nodejs";
// Cobre a verificação Turnstile + 1 chamada ao Apps Script (timeout de 22s).
export const maxDuration = 45;

/**
 * POST /api/inscricao
 *
 * Recebe o payload do wizard (JSON) com o estado completo da inscrição da
 * equipe: identificação da equipe, trilha, 4 integrantes (com aceites
 * individuais), proposta inicial, aceites coletivos e confirmação do líder.
 *
 * Fluxo:
 *   1. Honeypot anti-bot (silencioso)
 *   2. Rate limit por IP (in-memory, melhor esforço em serverless)
 *   3. Verifica Turnstile contra a API do Cloudflare
 *   4. Valida o payload contra o schema (`validateAll`) — mesmas regras do
 *      client; defesa quando alguém burla o front
 *   5. Normaliza (trim, lowercase email, formata telefones/CPFs)
 *   6. Envelope HMAC-SHA256 com `${ts}.${payload}` e envia ao Apps Script
 *   7. Apps Script faz dedupe por CPF e grava na planilha
 *
 * Env obrigatórias (definir em .env.local):
 *   APPS_SCRIPT_WEBHOOK_URL     — URL do Web App do Apps Script
 *   APPS_SCRIPT_WEBHOOK_SECRET  — token compartilhado pro HMAC
 *   TURNSTILE_SECRET_KEY        — chave secreta do Cloudflare Turnstile
 */

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Tamanho máximo do payload — defesa contra request explosivo.
// Cálculo: 4 integrantes × ~30 campos × ~500 bytes (worst case) + equipe +
// proposta + aceites ≈ 60KB. 200KB dá folga generosa.
const MAX_PAYLOAD_BYTES = 200 * 1024;

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY não configurada");
    return false;
  }
  const params = new URLSearchParams();
  params.append("secret", TURNSTILE_SECRET_KEY);
  params.append("response", token);
  if (ip) params.append("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn("[turnstile] siteverify HTTP", res.status);
      return false;
    }
    const data = (await res.json().catch(() => null)) as
      | { success: boolean; "error-codes"?: string[] }
      | null;
    if (!data?.success) {
      console.warn("[turnstile] verificação rejeitada:", data?.["error-codes"]);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[turnstile] erro ao verificar token:", err);
    return false;
  }
}

// Rate limit: 5 envios por hora por IP. Janela deslizante em memória.
// Limitação: serverless é stateless entre cold starts e instâncias separadas,
// então isso protege contra rajadas em uma instância warm — não é um limite
// global perfeito.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

function checkRateLimit(ip: string): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  // GC oportunista
  if (rateLimitStore.size > 1000) {
    for (const [key, timestamps] of rateLimitStore) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, fresh);
    }
  }

  const history = (rateLimitStore.get(ip) ?? []).filter((t) => t > cutoff);
  const oldest = history[0] ?? now;
  const resetAt = oldest + RATE_LIMIT_WINDOW_MS;

  if (history.length >= RATE_LIMIT_MAX) {
    return { ok: false, remaining: 0, resetAt };
  }

  history.push(now);
  rateLimitStore.set(ip, history);
  return {
    ok: true,
    remaining: RATE_LIMIT_MAX - history.length,
    resetAt,
  };
}

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Chamada única ao webhook do Apps Script — SEM retry automático.
//
// Por que não retenta: se a 1ª tentativa estoura o timeout do cliente mas o
// Apps Script segue rodando no servidor, ela grava a linha mesmo assim. Um
// retry automático cairia no dedup e devolveria "duplicate_cpf" — apesar de a
// inscrição ter sido registrada. O Apps Script é idempotente por líder (ver
// doPost), então um retry MANUAL do usuário é recuperável; retry automático
// aqui só duplicaria trabalho e produziria erro enganoso.
async function fetchAppsScript(url: string, body: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(22_000),
  });
}

export async function POST(req: Request) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET || !TURNSTILE_SECRET_KEY) {
    return bad(
      "O sistema de inscrições ainda não foi configurado. Entre em contato com a organização.",
      500
    );
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    const wait =
      retryAfter < 90
        ? "alguns instantes"
        : `${Math.ceil(retryAfter / 60)} minutos`;
    return NextResponse.json(
      { ok: false, message: `Aguarde ${wait} antes de enviar uma nova inscrição.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  // Inscrições encerradas? Barra antes de qualquer trabalho. A página esconde
  // o formulário, mas quem mantém a aba aberta — ou chama a API direto — não
  // passa pela checagem do front; a borda precisa barrar também. O Apps Script
  // ainda revalida com a fonte autoritativa (checkbox da planilha).
  const statusInscricoes = await getInscriptionsStatus();
  if (!statusInscricoes.open) {
    return bad(
      statusInscricoes.message ||
        "As inscrições do Hackathon do Sol estão encerradas.",
      403
    );
  }

  // Lê o body com cap de tamanho — defesa contra payload absurdo. Content-Length
  // é mentiroso na borda (cliente pode mandar qualquer coisa); medimos o texto
  // real depois de ler.
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return bad("Não foi possível ler o corpo da requisição.");
  }
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return bad("Payload muito grande.", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return bad("Formato inválido — esperado JSON.");
  }

  const envelope = parsed as {
    state?: InscricaoFormState;
    turnstileToken?: string;
    honeypot?: string;
  };

  // Honeypot — responde "ok" pra não dar dica ao bot
  if (envelope.honeypot && envelope.honeypot.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // Turnstile primeiro — antes de validação cara
  if (!envelope.turnstileToken) {
    return bad(
      "Verificação anti-robô ausente. Atualize a página e tente novamente.",
      403
    );
  }
  const turnstileOk = await verifyTurnstile(
    envelope.turnstileToken,
    ip === "unknown" ? null : ip
  );
  if (!turnstileOk) {
    return bad(
      "Verificação anti-robô falhou. Atualize a página e tente novamente.",
      403
    );
  }

  // Schema check — defesa quando o cliente é burlado
  if (
    !envelope.state ||
    typeof envelope.state !== "object" ||
    !envelope.state.equipe ||
    !Array.isArray(envelope.state.integrantes) ||
    envelope.state.integrantes.length !== 4
  ) {
    return bad("Payload mal-formado.");
  }

  // Normaliza ANTES de validar — assim limites de tamanho e regex avaliam
  // o que vai realmente parar no banco.
  const normalized = normalizeForm(envelope.state);
  const { ok, errors } = validateAll(normalized);
  if (!ok) {
    console.warn("[inscricao] validação falhou:", JSON.stringify(errors));
    return NextResponse.json(
      {
        ok: false,
        message:
          "Há campos com problema na inscrição. Revise as etapas e tente novamente.",
        errors,
      },
      { status: 422 }
    );
  }

  // Pega Google ID + e-mail do líder da sessão. O googleId serve de identidade
  // estável (vincula a inscrição ao usuário mesmo se ele mudar o email
  // oficial). O leaderGoogleEmail vira o ÚNICO destinatário dos e-mails de
  // confirmação/aprovação/reprovação — comunicação oficial 1:1 com o líder.
  const session = await getServerSession(authOptions);
  // googleId é extensão custom (ver lib/auth.ts + types/next-auth.d.ts).
  const leaderGoogleId: string = session?.user?.googleId ?? "";
  const leaderGoogleEmail: string = session?.user?.email ?? "";

  // Envelope assinado por HMAC-SHA256. Campos extras fora do `state` pra
  // não bagunçar a normalização/validação do schema do form.
  const payload = JSON.stringify({
    ...normalized,
    leaderGoogleId,
    leaderGoogleEmail,
  });
  const ts = Date.now();
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${ts}.${payload}`)
    .digest("hex");
  const signedBody = JSON.stringify({ v: 2, ts, payload, signature });

  try {
    const res = await fetchAppsScript(WEBHOOK_URL, signedBody);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[inscricao] Apps Script retornou 4xx:", res.status, text);
      return bad(
        "Não foi possível registrar sua inscrição no momento. Tente novamente em instantes.",
        502
      );
    }

    const result = (await res.json().catch(() => null)) as
      | { ok: boolean; error?: string }
      | null;
    if (!result?.ok) {
      if (result?.error === "duplicate_cpf") {
        return bad(
          "Um dos CPFs informados já foi inscrito em outra equipe. Cada CPF só pode constar em uma inscrição.",
          409
        );
      }
      if (result?.error === "duplicate_email") {
        return bad(
          "Um dos e-mails informados já foi usado em outra inscrição. Entre em contato com a organização se não foi você.",
          409
        );
      }
      if (result?.error === "inscriptions_closed") {
        // Backstop autoritativo do Apps Script — só chega aqui se a checagem
        // do proxy passou (janela de cache) mas a planilha já estava fechada.
        return bad(
          "As inscrições do Hackathon do Sol estão encerradas.",
          403
        );
      }
      console.error("[inscricao] Apps Script retornou erro:", result?.error);
      return bad("Sua inscrição não pôde ser registrada. Tente novamente.", 502);
    }

    // Inscrição confirmada — apaga o rascunho do servidor (Upstash) aqui, de
    // forma confiável. O client também faz um DELETE best-effort, mas se a
    // rede dele falhar nesse instante o rascunho ficaria órfão e poderia
    // reaparecer em outro dispositivo. deleteDraft nunca lança.
    if (leaderGoogleEmail) {
      await deleteDraft(leaderGoogleEmail);
    }

    return NextResponse.json({
      ok: true,
      message:
        "Inscrição da equipe recebida! Cada integrante vai receber um e-mail de confirmação. A organização vai analisar e retorna o resultado por e-mail.",
    });
  } catch (err) {
    console.error("[inscricao] erro na chamada ao Apps Script:", err);
    return bad(
      "Falha ao enviar sua inscrição. Verifique sua conexão e tente novamente.",
      500
    );
  }
}
