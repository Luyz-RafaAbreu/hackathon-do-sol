// ============================================================================
// lib/draft-store.ts — backup server-side dos rascunhos do formulário
// ----------------------------------------------------------------------------
// Persiste o rascunho da inscrição no Upstash Redis (free tier dá 10.000
// requests/dia, 256MB total — sobra). Permite que o líder feche o navegador
// num dispositivo e retome em outro, ou que troque de Chrome → Edge sem
// perder o que preencheu.
//
// Chaves por modalidade:
//   - Equipe (atual):       `draft:<email-lowercase>`
//   - Individual (2026-06): `draft:individual:<email-lowercase>`
//
// Por que chaves separadas: a mesma conta Google pode preencher um modo,
// mudar de ideia e ir pro outro. Ter chaves separadas evita que o draft de
// um modo sobrescreva o do outro silenciosamente. Quem migra entre modos
// pode até ter dois drafts coexistindo — quando enviar uma inscrição, o
// dedup por googleId/CPF/email já protege duplicidade na planilha.
//
// TTL: 30 dias (cobre o período de inscrições com folga). Se as envs não
// estiverem setadas, todas as operações viram no-op — o sistema cai pro
// fallback de localStorage no client, sem quebrar.
// ============================================================================
import { Redis } from "@upstash/redis";

const TTL_SECONDS = 30 * 24 * 60 * 60;

export type DraftKind = "equipe" | "individual";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isDraftStoreConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Chave do draft. Para equipe (kind = "equipe") mantém o formato legacy
// `draft:<email>` — qualquer mudança aqui quebraria drafts já existentes
// no Upstash.
function key(email: string, kind: DraftKind = "equipe"): string {
  const lower = email.toLowerCase();
  return kind === "individual" ? `draft:individual:${lower}` : `draft:${lower}`;
}

export async function getDraft(
  email: string,
  kind: DraftKind = "equipe"
): Promise<unknown | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key(email, kind));
  } catch (err) {
    // Se Upstash estiver fora, o client cai pro localStorage. Não derruba
    // a UX por causa de uma feature de comodidade — mas loga, senão uma
    // queda do Upstash fica 100% invisível.
    console.error("[draft-store] getDraft falhou:", err);
    return null;
  }
}

export async function setDraft(
  email: string,
  state: unknown,
  kind: DraftKind = "equipe"
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key(email, kind), state, { ex: TTL_SECONDS });
  } catch (err) {
    // Não derruba a UX (o client tem localStorage), mas loga — uma falha
    // silenciosa aqui faz o rascunho cross-device sumir sem deixar rastro.
    console.error("[draft-store] setDraft falhou:", err);
  }
}

export async function deleteDraft(
  email: string,
  kind: DraftKind = "equipe"
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key(email, kind));
  } catch (err) {
    console.error("[draft-store] deleteDraft falhou:", err);
  }
}

// Marca o rascunho como "submetido" em vez de apagar — preserva os dados
// pra auditoria/recuperação caso a inscrição não tenha aparecido na planilha.
// O campo `_submittedAt` (ISO 8601) é o marker; GET /api/draft trata
// rascunhos marcados como inexistentes pro client (não restaura) mas eles
// continuam disponíveis pra `atualizarEmAndamento` no Apps Script.
//
// TTL é renovado pros 30 dias padrão a partir da marcação — janela mais
// que suficiente pra investigar qualquer falha pós-envio dentro do período
// de inscrições.
export async function markDraftSubmitted(
  email: string,
  kind: DraftKind = "equipe"
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const existing = (await redis.get(key(email, kind))) as
      | Record<string, unknown>
      | string
      | null;
    if (!existing) return; // sem draft, nada a marcar
    const parsed =
      typeof existing === "string" ? JSON.parse(existing) : existing;
    if (!parsed || typeof parsed !== "object") return;
    const marked = { ...parsed, _submittedAt: new Date().toISOString() };
    await redis.set(key(email, kind), marked, { ex: TTL_SECONDS });
  } catch (err) {
    console.error("[draft-store] markDraftSubmitted falhou:", err);
  }
}
