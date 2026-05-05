/**
 * Status das inscrições — flag controlado pela admin direto na planilha do
 * Google (aba "Configurações", célula B1). Quando ela desmarca a checkbox,
 * o site fecha em até ~1min (cache do fetch).
 *
 * Em caso de falha (Apps Script offline, env não setada, JSON malformado),
 * o default é OPEN. Preferimos deixar o usuário tentar do que bloquear
 * injustamente por causa de um blip.
 */

export type InscriptionsStatus = {
  open: boolean;
  message: string;
};

const DEFAULT_OPEN: InscriptionsStatus = { open: true, message: "" };

export async function getInscriptionsStatus(): Promise<InscriptionsStatus> {
  const url = process.env.APPS_SCRIPT_WEBHOOK_URL;
  if (!url) return DEFAULT_OPEN;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    // Apps Script em deploys antigos (sem doGet) devolve HTML. Detecta antes
    // de tentar parsear pra evitar exception ruidosa.
    if (!ct.includes("application/json")) {
      return DEFAULT_OPEN;
    }
    const data = (await res.json()) as Partial<InscriptionsStatus>;
    return {
      open: typeof data.open === "boolean" ? data.open : true,
      message: typeof data.message === "string" ? data.message : "",
    };
  } catch (err) {
    console.warn("[inscriptions] falha ao carregar status, default open:", err);
    return DEFAULT_OPEN;
  }
}
