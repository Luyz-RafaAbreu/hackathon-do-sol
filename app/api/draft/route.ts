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

const MAX_PAYLOAD_BYTES = 200_000; // 200 KB — mesmo limite da /api/inscricao

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
  if (!body.state || typeof body.state !== "object") {
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
