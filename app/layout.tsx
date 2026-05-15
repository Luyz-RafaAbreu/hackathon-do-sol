import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CustomCursor from "@/components/CustomCursor";
import CustomScrollbar from "@/components/CustomScrollbar";
import SmoothScroll from "@/components/SmoothScroll";
import GrainOverlay from "@/components/GrainOverlay";
import { EVENT } from "@/lib/event";
import "./globals.css";

// next/font baixa as fontes no build, serve do nosso próprio domínio (sem
// request a fonts.googleapis.com em runtime), faz preload no <head> e calcula
// uma fonte de fallback com métricas próximas pra reduzir layout shift.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Mono — usada em eyebrows, contadores, datas e outros "data accents".
// Reforça vibe técnica sem virar terminal-cosplay.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// JSON-LD do tipo Event (schema.org). Permite ao Google montar rich snippets
// — data destacada, local, link de inscrição direto na busca.
const eventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: EVENT.NAME,
  startDate: EVENT.START_DATE.toISOString(),
  endDate: EVENT.END_DATE.toISOString(),
  eventStatus: EVENT.STATUS,
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  description: `${EVENT.NAME} — ${EVENT.DATE_RANGE_LONG}, no ${EVENT.LOCATION_NAME_OFFICIAL} (${EVENT.CITY_STATE}). Três dias de imersão em código, design e inovação, com ${EVENT.PRIZE} em premiação.`,
  image: [`${EVENT.SITE_URL}/imagens/og.jpg`],
  location: {
    "@type": "Place",
    name: EVENT.LOCATION_NAME_OFFICIAL,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${EVENT.LOCATION_ADDRESS} — ${EVENT.LOCATION_NEIGHBORHOOD}`,
      addressLocality: EVENT.LOCATION_CITY,
      addressRegion: EVENT.LOCATION_STATE,
      postalCode: EVENT.LOCATION_ZIP,
      addressCountry: "BR",
    },
  },
  offers: {
    "@type": "Offer",
    url: `${EVENT.SITE_URL}/inscricao`,
    price: "0",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    validFrom: "2026-05-20T00:00:00-03:00",
  },
  organizer: {
    "@type": "Organization",
    name: EVENT.NAME,
    url: EVENT.SITE_URL,
  },
};

// `theme-color` pinta o chrome do navegador no Android Chrome e a barra do
// Safari iOS — mesmo valor do `theme_color` do manifest pra ficar coerente.
export const viewport: Viewport = {
  themeColor: "#1a0b3d",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || EVENT.SITE_URL
  ),
  title: `${EVENT.NAME} | ${EVENT.DATE_RANGE_SHORT} — ${EVENT.CITY_STATE}`,
  description: `${EVENT.NAME} — ${EVENT.DATE_RANGE_LONG}, no ${EVENT.LOCATION_NAME_OFFICIAL} (${EVENT.CITY_STATE}). Três dias de imersão em código, design e inovação, com ${EVENT.PRIZE} em premiação. Inscrições abertas.`,
  keywords: [
    EVENT.NAME,
    `hackathon ${EVENT.YEAR}`,
    `hackathon ${EVENT.LOCATION_CITY}`,
    "hackathon Rio Grande do Norte",
    "hackathon nordeste",
    "inovação",
    "tecnologia",
    "programação",
    EVENT.LOCATION_NAME,
    `${EVENT.LOCATION_CITY} ${EVENT.LOCATION_STATE}`,
    "evento tech",
  ],
  // Ícones agora vêm das convenções do App Router:
  //   app/favicon.ico         — aba do navegador (sol recortado em 32x32)
  //   app/icon.png            — Android + browser moderno (512x512, logo completo)
  //   app/apple-icon.png      — iOS home screen (180x180, logo completo)
  //   app/manifest.ts         — config de "add to home screen"
  // Next descobre por convenção, não precisa listar aqui.
  openGraph: {
    title: `${EVENT.NAME} — ${EVENT.DATE_RANGE_SHORT}`,
    description: `Três dias de imersão em código, design e inovação em ${EVENT.CITY_STATE}. ${EVENT.PRIZE} em premiação. Inscrições abertas.`,
    type: "website",
    locale: "pt_BR",
    siteName: EVENT.NAME,
    // Imagem é gerada dinamicamente em app/opengraph-image.tsx (countdown ao vivo).
  },
  twitter: {
    card: "summary_large_image",
    title: `${EVENT.NAME} — ${EVENT.DATE_RANGE_SHORT}`,
    description: `Três dias de imersão em código, design e inovação em ${EVENT.CITY_STATE}. ${EVENT.PRIZE} em premiação.`,
    // Imagem é gerada dinamicamente em app/twitter-image.tsx.
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce vem do middleware (ver middleware.ts). CSP em produção só executa
  // scripts inline que tenham esse nonce — sem ele, o JSON-LD seria bloqueado.
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          nonce={nonce}
          // O navegador apaga o atributo `nonce` do DOM após o parse (defesa
          // contra exfil de nonce via script injetado), o que confunde a
          // hydration do React — daí o suppress. O nonce vai pro HTML normal,
          // CSP valida no carregamento; React só não fica conferindo depois.
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
        <SmoothScroll />
        <CustomScrollbar />
        <CustomCursor />
        <GrainOverlay />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
