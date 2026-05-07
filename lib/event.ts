// Fonte única de verdade dos dados do evento.
//
// Mude AQUI quando a data, local, prêmio ou capacidade mudar — todo o site
// que importa de `@/lib/event` se atualiza junto: Hero, Countdown, OG image
// dinâmica, JSON-LD, Footer e metadata.
//
// Não cobertos automaticamente (ainda têm texto narrativo embutido):
//   - components/Sobre.tsx
//   - components/FAQ.tsx
//   - components/Cronograma.tsx
//   - components/Informacoes.tsx
//   - components/NotFoundHero.tsx
//   - components/Inscricao.tsx (frase "160 vagas")
//   - app/not-found.tsx (description)
//   - scripts/apps-script.gs (CONFIG roda no Google, fonte separada)
// Ao mexer nas constantes abaixo, dê uma busca por "26 a 28", "Praiamar",
// "10 mil", "160 vagas" pra cobrir esses textos manualmente.

const startDate = new Date("2026-06-26T09:00:00-03:00");
const endDate = new Date("2026-06-28T18:00:00-03:00");

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const startDay = startDate.getDate();
const endDay = endDate.getDate();
const monthName = MONTHS_PT[startDate.getMonth()]!;
const year = startDate.getFullYear();

// Status do evento (schema.org/EventStatusType). Mude AQUI se algo mudar de plano:
//   "EventScheduled"   — vai acontecer normalmente (default)
//   "EventCancelled"   — cancelado
//   "EventPostponed"   — adiado sem data nova
//   "EventRescheduled" — remarcado (atualizar START_DATE/END_DATE também)
//   "EventMovedOnline" — virou online
const eventStatus = "EventScheduled";

const locationName = "Praiamar Arena";
const locationAddress = "Av. Senador Salgado Filho, 1906";
const locationNeighborhood = "Lagoa Nova";
const locationCity = "Natal";
const locationState = "RN";
const locationZip = "59075-000";

export const EVENT = {
  NAME: "Hackathon do Sol",

  // Janela do evento — Date objects pra Countdown, JSON-LD, OG image
  START_DATE: startDate,
  END_DATE: endDate,
  YEAR: year,
  MONTH_NAME: monthName,
  START_DAY: startDay,
  END_DAY: endDay,

  // Local — partes individuais
  LOCATION_NAME: locationName,
  LOCATION_ADDRESS: locationAddress,
  LOCATION_NEIGHBORHOOD: locationNeighborhood,
  LOCATION_CITY: locationCity,
  LOCATION_STATE: locationState,
  LOCATION_ZIP: locationZip,

  // Local — strings prontas
  CITY_STATE: `${locationCity}/${locationState}`, // "Natal/RN"
  LOCATION_SHORT: `${locationName}, ${locationCity}/${locationState}`, // "Praiamar Arena, Natal/RN"
  LOCATION_FULL: `${locationAddress}, ${locationNeighborhood}, ${locationCity}/${locationState}`, // sem CEP

  // Datas — strings prontas
  DAYS_RANGE: `${startDay} a ${endDay}`, // "26 a 28"
  DAYS_RANGE_UPPER: `${startDay} A ${endDay}`, // "26 A 28"
  DATE_RANGE_SHORT: `${startDay} a ${endDay} de ${monthName}`, // "26 a 28 de junho"
  DATE_RANGE_LONG: `${startDay} a ${endDay} de ${monthName} de ${year}`, // "26 a 28 de junho de 2026"
  MONTH_UPPER: monthName.toUpperCase(), // "JUNHO"

  // Números
  PRIZE: "R$ 10 mil",
  SLOTS: 160,

  // Status (schema.org)
  STATUS: `https://schema.org/${eventStatus}`,

  // URLs
  SITE_URL: "https://hackathondosol.com.br",
} as const;
