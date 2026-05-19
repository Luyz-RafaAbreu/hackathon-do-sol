// ============================================================================
// app/api/inscricao/status/route.ts — consulta status da inscrição
// ----------------------------------------------------------------------------
// GET /api/inscricao/status → { ok: true, status: "Pendente"|"Aprovado"|"Reprovado"|null }
//
// Requer sessão (NextAuth). Usa o e-mail da sessão Google pra perguntar ao
// Apps Script qual o status da inscrição em que esse e-mail aparece (oficial
// ou pessoal de qualquer integrante). Sem inscrição → status: null.
//
// Mesmo envelope HMAC do /api/inscricao (v2 com action="status").
// ============================================================================
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 15;

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  // @ts-expect-error — googleId é extensão custom de session.user
  const googleId: string = session.user.googleId ?? "";
  const payload = JSON.stringify({
    action: "status",
    googleId,
    email: session.user.email,
  });
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
    return NextResponse.json({ ok: true, status: data.status ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "network" }, { status: 502 });
  }
}
