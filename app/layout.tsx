import type { Metadata } from "next";
import CustomCursor from "@/components/CustomCursor";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Hackathon do Sol | 26 a 28 de junho — Natal/RN",
  description:
    "Hackathon do Sol — 26 a 28 de junho de 2026, na Praiamar Arena (Natal/RN). Três dias de imersão em código, design e inovação, com R$ 10 mil em premiação. Inscrições abertas.",
  keywords: [
    "Hackathon do Sol",
    "hackathon 2026",
    "hackathon Natal",
    "hackathon Rio Grande do Norte",
    "hackathon nordeste",
    "inovação",
    "tecnologia",
    "programação",
    "Praiamar Arena",
    "Natal RN",
    "evento tech",
  ],
  icons: {
    icon: "/imagens/logo.png",
    apple: "/imagens/logo.png",
  },
  openGraph: {
    title: "Hackathon do Sol — 26 a 28 de junho",
    description:
      "Três dias de imersão em código, design e inovação em Natal/RN. R$ 10 mil em premiação. Inscrições abertas.",
    type: "website",
    locale: "pt_BR",
    siteName: "Hackathon do Sol",
    images: [{ url: "/imagens/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hackathon do Sol — 26 a 28 de junho",
    description:
      "Três dias de imersão em código, design e inovação em Natal/RN. R$ 10 mil em premiação.",
    images: ["/imagens/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
