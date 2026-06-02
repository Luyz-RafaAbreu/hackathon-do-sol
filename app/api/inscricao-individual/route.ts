import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  InscricaoIndividualState,
  normalizeIndividual,
  validateIndividual,
} from "@/lib/inscricao-schema";
import { getInscriptionsStatus } from "@/lib/inscriptions";
import { markDraftSubmitted } from "@/lib/draft-store";

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * POST /api/inscricao-individual
 *
 * Modo INDIVIDUAL — a pessoa se inscreve sozinha e a organização forma a
 * equipe (ver lib/inscricao-schema.ts → InscricaoIndividualState).
 *
 * Mesmo formato de envelope HMAC do /api/inscricao (equipe), mas:
 *   • Valida contra `validateIndividual` (1 integrante + trilha + aceite extra)
 *   • Marca `kind: "individual"` no payload pro Apps Script rotear
 *   • Apps Script grava na aba "Inscricoes Individuais" (separada) e roda
 *     dedup cruzado contra a aba "Inscricoes" da equipe
 */

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Payload do individual é bem menor (1 integrante + trilha). 100 KB já dá
// muita folga; mantemos 200 KB pra paridade com o equipe e simplicidade.
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
      console.warn("[turnstile-individual] siteverify HTTP", res.status);
      return false;
    }
    const data = (await res.json().catch(() => null)) as
      | { success: boolean; "error-codes"?: string[] }
      | null;
    if (!data?.success) {
      console.warn(
        "[turnstile-individual] verificação rejeitada:",
        data?.["error-codes"]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[turnstile-individual] erro ao verificar token:", err);
    return false;
  }
}

// Rate limit dedicado pro individual — independente do equipe. Mesmo padrão:
// 5 por hora por IP, in-memory (best effort em serverless).
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

  const statusInscricoes = await getInscriptionsStatus();
  if (!statusInscricoes.open) {
    return bad(
      statusInscricoes.message ||
        "As inscrições do Hackathon do Sol estão encerradas.",
      403
    );
  }

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
    state?: InscricaoIndividualState;
    turnstileToken?: string;
    honeypot?: string;
  };

  if (envelope.honeypot && envelope.honeypot.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

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

  if (
    !envelope.state ||
    typeof envelope.state !== "object" ||
    !envelope.state.integrante ||
    typeof envelope.state.trilhaPreferida !== "string"
  ) {
    return bad("Payload mal-formado.");
  }

  const normalized = normalizeIndividual(envelope.state);
  const { ok, errors } = validateIndividual(normalized);
  if (!ok) {
    console.warn("[inscricao-individual] validação falhou:", JSON.stringify(errors));
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

  const session = await getServerSession(authOptions);
  const leaderGoogleId: string = session?.user?.googleId ?? "";
  const leaderGoogleEmail: string = session?.user?.email ?? "";

  // Discriminator `kind: "individual"` no payload — Apps Script roteia
  // pra handleIndividual_. Sem isso, o doPost cai no fluxo de equipe e
  // rejeita por estrutura inválida.
  const payload = JSON.stringify({
    kind: "individual",
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
      console.error(
        "[inscricao-individual] Apps Script retornou 4xx:",
        res.status,
        text
      );
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
          "Seu CPF já consta em outra inscrição (individual ou em equipe). Cada CPF só pode constar em uma inscrição.",
          409
        );
      }
      if (result?.error === "duplicate_email") {
        return bad(
          "Seu e-mail já consta em outra inscrição (individual ou em equipe). Entre em contato com a organização se não foi você.",
          409
        );
      }
      if (result?.error === "inscriptions_closed") {
        return bad(
          "As inscrições do Hackathon do Sol estão encerradas.",
          403
        );
      }
      console.error("[inscricao-individual] Apps Script retornou erro:", result?.error);
      return bad("Sua inscrição não pôde ser registrada. Tente novamente.", 502);
    }

    // Marca o rascunho como "submetido" (preserva pra auditoria; GET
    // /api/draft trata como inexistente). Mesma lógica do fluxo de
    // equipe — apenas a chave do Redis muda (draft:individual:<email>).
    if (leaderGoogleEmail) {
      await markDraftSubmitted(leaderGoogleEmail, "individual");
    }

    return NextResponse.json({
      ok: true,
      message:
        "Inscrição individual recebida! Você vai receber um e-mail de confirmação. A organização analisa e responde por e-mail.",
    });
  } catch (err) {
    console.error("[inscricao-individual] erro na chamada ao Apps Script:", err);
    return bad(
      "Falha ao enviar sua inscrição. Verifique sua conexão e tente novamente.",
      500
    );
  }
}
