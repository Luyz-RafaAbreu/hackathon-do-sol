/**
 * Status das inscrições — flag controlado pela admin direto na planilha do
 * Google (aba "Configurações", célula B1). Quando ela desmarca a checkbox,
 * o site fecha em até ~1min (cache do fetch).
 *
 * Em caso de falha (Apps Script offline, env não setada, JSON malformado),
 * usa o calendário do Edital como guia:
 *   - Antes ou durante a janela (até INSCRIPTIONS_CLOSE 23:59) → fail-OPEN
 *     (não bloqueia injustamente por causa de um blip transitório)
 *   - Depois da janela → fail-CLOSED (não aceita inscrições fora do prazo
 *     mesmo se o flag da planilha estiver inacessível)
 */
import { EVENT } from "@/lib/event";

export type InscriptionsStatus = {
  open: boolean;
  message: string;
};

// Fallback baseado no calendário: dentro da janela do Edital → aberto;
// depois → fechado. Faz o "fail-safe" no pior caso (Apps Script morto
// pós-prazo), evita o user preencher form que nunca vai ser aceito.
function fallbackByCalendar(): InscriptionsStatus {
  const past = Date.now() > EVENT.INSCRIPTIONS_CLOSE_DATE.getTime();
  return past
    ? { open: false, message: "" }
    : { open: true, message: "" };
}

export async function getInscriptionsStatus(): Promise<InscriptionsStatus> {
  const url = process.env.APPS_SCRIPT_WEBHOOK_URL;
  if (!url) return fallbackByCalendar();

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    // Apps Script em deploys antigos (sem doGet) devolve HTML. Detecta antes
    // de tentar parsear pra evitar exception ruidosa.
    if (!ct.includes("application/json")) {
      return fallbackByCalendar();
    }
    const data = (await res.json()) as Partial<InscriptionsStatus>;
    return {
      open: typeof data.open === "boolean" ? data.open : true,
      message: typeof data.message === "string" ? data.message : "",
    };
  } catch (err) {
    const fb = fallbackByCalendar();
    console.warn(
      `[inscriptions] falha ao carregar status, fallback por calendário (open=${fb.open}):`,
      err
    );
    return fb;
  }
}
