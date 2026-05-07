import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { FIELD_MAX_LENGTH } from "@/lib/limits";

export const runtime = "nodejs";
// Folga pra cobrir 1 retry de até 12s + backoff em caso de Apps Script lento.
export const maxDuration = 30;

/**
 * POST /api/inscricao
 *
 * Recebe o FormData do formulário (incluindo arquivos), valida, converte os
 * arquivos em base64 e repassa para o Google Apps Script Web App configurado
 * via env. Do lado de lá, os dados vão parar em uma planilha do Google Sheets
 * e os arquivos em uma pasta do Drive.
 *
 * Env obrigatórias (definir em .env.local):
 *   APPS_SCRIPT_WEBHOOK_URL     — URL do Web App do Apps Script
 *   APPS_SCRIPT_WEBHOOK_SECRET  — token secreto igual ao do Apps Script
 *
 * Autenticação com Apps Script: enviamos um envelope assinado por HMAC-SHA256
 * sobre `${ts}.${payload}` usando WEBHOOK_SECRET. O Apps Script recalcula a
 * assinatura e rejeita se não bater (ou se o timestamp tiver mais de 5 min de
 * diferença, pra impedir replay de requests antigos).
 */

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Valida o token do Cloudflare Turnstile contra a API oficial. Retorna `false`
// em qualquer cenário não-claro (token inválido/reusado/expirado, env faltando,
// timeout, erro de rede) — fail-closed pra não aceitar inscrição sem garantia.
async function verifyTurnstile(
  token: string,
  ip: string | null
): Promise<boolean> {
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

// 1 MB/arquivo × 3 = 3 MB raw → ~4 MB em base64, cabe no limite de 4.5 MB do
// Vercel Hobby. Ultrapassar esse orçamento causa erro 413 antes da API.
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const MAX_FILES = 3;
// Validação dupla com o cliente — protege se alguém burlar o front.
const MAX_TOTAL_SIZE = 3 * 1024 * 1024;

// Rate limit: 5 envios por hora por IP. Janela deslizante em memória.
// Limitação: serverless é stateless entre cold starts e instâncias separadas,
// então isso protege contra rajadas em uma instância warm — não é um limite
// global perfeito. Pra defesa global de verdade, mover pra Upstash/Vercel KV.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

function getClientIp(req: Request): string {
  // Preferimos x-real-ip a x-forwarded-for: na Vercel o proxy reescreve
  // x-real-ip com o IP de verdade do cliente, ignorando o que veio na request.
  // Já x-forwarded-for é uma cadeia "client, proxy1, proxy2..." cujo primeiro
  // item pode ser injetado pelo próprio cliente (depende do proxy reescrever a
  // cadeia inteira pra ser seguro — comportamento que varia por host).
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  // Fallback pra ambientes sem x-real-ip (dev local, alguns hosts). Identificador
  // menos confiável, mas melhor que nada — pode ser spoofado por cliente malicioso.
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

  // GC oportunista: limpa chaves antigas pra não vazar memória
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
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Magic bytes (file signatures) por categoria. file.type vem do cliente e é
// falsificável, então detectamos a "categoria real" pelo conteúdo do arquivo
// e exigimos consistência com o MIME declarado.
type FileKind = "pdf" | "jpeg" | "png" | "webp" | "ole" | "zip";

// MIMEs aceitos por categoria detectada. DOC antigo compartilha assinatura OLE
// com xls/ppt/msi, e DOCX é um zip — bloqueamos rejeitando se file.type
// declarado não bater com a categoria.
const KIND_TO_MIMES: Record<FileKind, string[]> = {
  pdf: ["application/pdf"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  ole: ["application/msword"],
  zip: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (bytes.length < 4) return null;

  // %PDF-
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "pdf";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  // OLE Compound File (DOC/XLS/PPT antigos): D0 CF 11 E0 A1 B1 1A E1
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return "ole";
  }

  // ZIP (DOCX e variantes): 50 4B [03 04 | 05 06 | 07 08]
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return "zip";
  }

  return null;
}

const REQUIRED_FIELDS = [
  "nome",
  "email",
  "telefone",
  "cidadeEstado",
  "instituicao",
  "area",
  "experiencia",
  "motivacao",
] as const;

type Field = (typeof REQUIRED_FIELDS)[number];

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Retenta o webhook do Apps Script em caso de timeout/erro de rede ou 5xx.
// 4xx é erro do cliente — não retenta porque vai falhar de novo.
async function fetchAppsScriptWithRetry(
  url: string,
  body: string
): Promise<Response> {
  const MAX_ATTEMPTS = 2;
  const PER_ATTEMPT_TIMEOUT_MS = 12_000;
  const BACKOFF_MS = 500;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
      });
      if (res.status < 500) return res;
      // 5xx — drena o body pra liberar a conexão e tenta de novo
      const text = await res.text().catch(() => "");
      console.warn(
        `[inscricao] Apps Script ${res.status} (tentativa ${attempt}/${MAX_ATTEMPTS}): ${text}`
      );
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn(
        `[inscricao] Apps Script falhou (tentativa ${attempt}/${MAX_ATTEMPTS}):`,
        err
      );
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
    }
  }

  throw lastError ?? new Error("Apps Script unreachable");
}

// Normaliza telefone BR pra formato visual consistente.
// 11 dígitos (celular): (XX) XXXXX-XXXX
// 10 dígitos (fixo):    (XX) XXXX-XXXX
// Qualquer outro tamanho cai em dígitos puros — mantém compatibilidade com
// números estrangeiros eventuais sem perder informação.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
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
      {
        ok: false,
        message: `Aguarde ${wait} antes de enviar uma nova inscrição.`,
      },
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Formato inválido.");
  }

  // Honeypot anti-bot — campo oculto no form. Bots preenchem, humanos não.
  if (form.get("website")) {
    // Responde "ok" silenciosamente pra não dar dica ao bot
    return NextResponse.json({ ok: true });
  }

  // Cloudflare Turnstile — exige token válido antes de qualquer outra validação
  // ou processamento de arquivo (que é caro). Token é single-use; o widget no
  // cliente reseta após sucesso pra forçar um novo desafio em re-submissões.
  const turnstileToken = form.get("cf-turnstile-response");
  if (typeof turnstileToken !== "string" || !turnstileToken) {
    return bad(
      "Verificação anti-robô ausente. Atualize a página e tente novamente.",
      403
    );
  }
  const turnstileOk = await verifyTurnstile(turnstileToken, ip === "unknown" ? null : ip);
  if (!turnstileOk) {
    return bad(
      "Verificação anti-robô falhou. Atualize a página e tente novamente.",
      403
    );
  }

  // Coleta e valida campos de texto. Limite de tamanho é defesa contra clientes
  // que ignoram o maxLength do front (curl, scripts) — sem isso, alguém pode
  // colar um livro no campo motivação e estourar o payload de 4.5MB da Vercel
  // ou poluir a planilha.
  const data: Record<string, string> = {};
  for (const field of REQUIRED_FIELDS) {
    const raw = form.get(field);
    if (typeof raw !== "string" || !raw.trim()) {
      return bad(`Campo obrigatório ausente: ${field}`);
    }
    const trimmed = raw.trim();
    const max = FIELD_MAX_LENGTH[field];
    if (trimmed.length > max) {
      return bad(`Campo "${field}" muito longo (máximo ${max} caracteres).`);
    }
    data[field] = trimmed;
  }

  // Validações específicas
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return bad("E-mail inválido.");
  }
  data.email = data.email.toLowerCase();
  {
    const digits = data.telefone.replace(/\D/g, "").length;
    if (digits < 10 || digits > 11) {
      return bad("Telefone inválido.");
    }
  }
  data.telefone = normalizePhone(data.telefone);
  if (data.motivacao.length < 20) {
    return bad("Motivação muito curta (mínimo 20 caracteres).");
  }
  if (data.nome.length < 3) {
    return bad("Nome inválido.");
  }

  // Arquivos
  const rawFiles = form.getAll("comprovantes");
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0
  );

  if (files.length === 0) {
    return bad("Anexe ao menos um comprovante de atuação.");
  }
  if (files.length > MAX_FILES) {
    return bad(`Máximo ${MAX_FILES} arquivos.`);
  }

  // Validação de tamanho total — feita antes de ler arrayBuffer pra economizar
  // memória/CPU caso o cliente tenha mandado payload grande demais.
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    const mb = (totalSize / 1024 / 1024).toFixed(1);
    const max = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0);
    return bad(
      `Os arquivos somam ${mb} MB. O total não pode passar de ${max} MB.`,
      413
    );
  }

  const comprovantes: { name: string; type: string; data: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      const mb = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
      return bad(`O arquivo "${file.name}" excede o limite de ${mb} MB.`);
    }
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return bad(`Tipo de arquivo não aceito: ${file.name}`);
    }

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const kind = detectFileKind(bytes);
    if (!kind) {
      return bad(
        `O arquivo "${file.name}" não parece ser um PDF, imagem ou Word válido.`
      );
    }

    // Se o cliente declarou um type, ele tem que bater com o conteúdo real.
    // Se veio vazio (alguns OS/browsers fazem isso pra .doc), aceitamos desde
    // que a categoria detectada esteja na allowlist.
    const allowedForKind = KIND_TO_MIMES[kind];
    if (file.type && !allowedForKind.includes(file.type)) {
      return bad(
        `O arquivo "${file.name}" foi enviado como "${file.type}" mas o conteúdo não corresponde.`
      );
    }

    const finalType = file.type || allowedForKind[0]!;
    comprovantes.push({
      name: file.name,
      type: finalType,
      data: Buffer.from(buf).toString("base64"),
    });
  }

  // Repassa para o Apps Script — envelope assinado por HMAC-SHA256.
  // O Apps Script valida { v, ts, payload, signature } antes de processar.
  const payload = JSON.stringify({ ...data, comprovantes });
  const ts = Date.now();
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${ts}.${payload}`)
    .digest("hex");
  const signedBody = JSON.stringify({ v: 1, ts, payload, signature });

  try {
    const res = await fetchAppsScriptWithRetry(WEBHOOK_URL, signedBody);

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
      // Email duplicado → 409 com mensagem clara pro usuário
      if (result?.error === "duplicate_email") {
        return bad(
          "Este e-mail já foi usado em outra inscrição. Se você não se inscreveu, entre em contato com a organização.",
          409
        );
      }
      console.error("[inscricao] Apps Script retornou erro:", result?.error);
      return bad(
        "Sua inscrição não pôde ser registrada. Tente novamente.",
        502
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Inscrição recebida! A organização vai analisar e você receberá um e-mail com o resultado.",
    });
  } catch (err) {
    console.error("[inscricao] erro na chamada ao Apps Script:", err);
    return bad(
      "Falha ao enviar sua inscrição. Verifique sua conexão e tente novamente.",
      500
    );
  }
}
