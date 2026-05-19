// ============================================================================
// app/api/draft/route.ts — endpoints de rascunho do formulário
// ----------------------------------------------------------------------------
// GET    /api/draft  → { ok, draft }  — retorna o rascunho salvo (ou null)
// POST   /api/draft  → { ok }         — persiste { state } no servidor
// DELETE /api/draft  → { ok }         — limpa o rascunho (após envio bem-sucedido)
//
// Autenticação obrigatória — usa a sessão do NextAuth pra identificar o
// dono do rascunho. Sem login, retorna 401.
//
// Se UPSTASH_REDIS_REST_* não estiver configurado, retorna sucesso vazio
// (draft: null) — o client cai pro fallback localStorage sem perceber.
//
// Defesas no POST:
//   - 200KB de teto no payload (igual /api/inscricao)
//   - Shape mínimo do state (não validação completa — drafts podem ser
//     parciais, mas precisam ter a estrutura básica)
//   - Rate limit 300 writes/hora por email (legítimo bate ~120/h em uso
//     intenso; >300/h é flood)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteDraft,
  getDraft,
  isDraftStoreConfigured,
  setDraft,
} from "@/lib/draft-store";

const MAX_PAYLOAD_BYTES = 200_000;

const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(key: string): { ok: boolean; resetAt: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  // GC oportunista — purga entradas vencidas quando o Map cresce muito.
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

// Validação estrutural mínima — drafts podem ser parciais (user só
// preencheu nome da equipe), mas precisam ter as 5 chaves esperadas com
// shape correto. Bloqueia payloads totalmente arbitrários.
function isValidDraftShape(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  const s = state as Record<string, unknown>;
  if (!s.equipe || typeof s.equipe !== "object") return false;
  if (!Array.isArray(s.integrantes) || s.integrantes.length !== 4) return false;
  if (!s.proposta || typeof s.proposta !== "object") return false;
  if (!s.aceitesColetivos || typeof s.aceitesColetivos !== "object") return false;
  if (!s.liderConfirmacao || typeof s.liderConfirmacao !== "object") return false;
  return true;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isDraftStoreConfigured()) {
    return NextResponse.json({ ok: true, draft: null });
  }
  const draft = await getDraft(session.user.email);
  return NextResponse.json({ ok: true, draft });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isDraftStoreConfigured()) {
    // Falha silenciosa — client continua salvando em localStorage. Retorna
    // ok pra não poluir o console com fetch errors.
    return NextResponse.json({ ok: true });
  }

  const rl = checkRateLimit(session.user.email.toLowerCase());
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

  const raw = await req.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "payload too large" },
      { status: 413 }
    );
  }
  let body: { state?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!isValidDraftShape(body.state)) {
    return NextResponse.json({ ok: false, error: "invalid state" }, { status: 400 });
  }

  await setDraft(session.user.email, body.state);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isDraftStoreConfigured()) {
    return NextResponse.json({ ok: true });
  }
  await deleteDraft(session.user.email);
  return NextResponse.json({ ok: true });
}
