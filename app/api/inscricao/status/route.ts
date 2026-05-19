// ============================================================================
// app/api/inscricao/status/route.ts — consulta status da inscrição
// ----------------------------------------------------------------------------
// GET /api/inscricao/status → { ok: true, status: "Pendente"|"Aprovado"|"Reprovado"|null }
//
// Requer sessão (NextAuth). Usa googleId+e-mail da sessão pra perguntar ao
// Apps Script qual o status da inscrição. Sem inscrição → status: null.
//
// Defesas contra abuso:
//   1. Cache de 20s por googleId — UserMenu pode ser aberto/fechado várias
//      vezes sem cada um virar request ao Apps Script. Mudança de status
//      pelo chefe demora no máximo 20s pra refletir, aceitável.
//   2. Rate limit 20 req/5min por googleId — impede usuário autenticado de
//      floodear o quota do Apps Script (cada consulta lê linhas da planilha).
//
// Ambos são in-memory (per-instance em serverless). Em pico real (160 equipes)
// é suficiente — pra defesa global, Upstash seria o próximo passo.
// ============================================================================
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 15;

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;

// Rate limit: 20 consultas em 5min por chave (googleId, com fallback email).
// O número assume que o user pode atualizar status com frequência logo após
// o admin avaliar — checar 20x em 5min é razoável; 21+ é abusivo.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

const CACHE_TTL_MS = 20_000;
const statusCache = new Map<string, { status: string | null; expiresAt: number }>();

function checkRateLimit(key: string): { ok: boolean; resetAt: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  // GC oportunista — evita o Map crescer sem fim em instâncias warm
  if (rateLimitStore.size > 500) {
    for (const [k, ts] of rateLimitStore) {
      const fresh = ts.filter((t) => t > cutoff);
      if (fresh.length === 0) rateLimitStore.delete(k);
      else rateLimitStore.set(k, fresh);
    }
  }

  const hist = (rateLimitStore.get(key) ?? []).filter((t) => t > cutoff);
  if (hist.length >= RATE_LIMIT_MAX) {
    return { ok: false, resetAt: (hist[0] ?? now) + RATE_LIMIT_WINDOW_MS };
  }
  hist.push(now);
  rateLimitStore.set(key, hist);
  return { ok: true, resetAt: now + RATE_LIMIT_WINDOW_MS };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  // googleId vem do callback de lib/auth.ts; tipo declarado em
  // types/next-auth.d.ts.
  const googleId: string = session.user.googleId ?? "";
  const email = session.user.email;
  // googleId é estável mesmo se o user trocar o e-mail Google; cai pro
  // email quando googleId está ausente (logins antigos antes do callback).
  const cacheKey = googleId || email.toLowerCase();

  const cached = statusCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, status: cached.status });
  }

  const rl = checkRateLimit(cacheKey);
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const payload = JSON.stringify({ action: "status", googleId, email });
  const ts = Date.now();
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${ts}.${payload}`)
    .digest("hex");
  const signedBody = JSON.stringify({ v: 2, ts, payload, signature });

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: signedBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
    }
    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; status?: string | null }
      | null;
    if (!data?.ok) {
      return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
    }
    const status = data.status ?? null;
    statusCache.set(cacheKey, { status, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ ok: false, error: "network" }, { status: 502 });
  }
}
