import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Hackathon do Sol | 26 a 28 de junho — Praiamar Arena",
  description:
    "O Hackathon do Sol é um evento de inovação e tecnologia que reúne mentes criativas para construir soluções reais. 26 a 28 de junho, na Praiamar Arena, Natal/RN.",
  keywords: [
    "Hackathon do Sol",
    "hackathon",
    "inovação",
    "tecnologia",
    "Praiamar Arena",
    "Natal",
    "evento tech",
  ],
  icons: {
    icon: "/imagens/logo.png",
    apple: "/imagens/logo.png",
  },
  openGraph: {
    title: "Hackathon do Sol — 26 a 28 de junho",
    description:
      "Três dias de inovação, código e colaboração na Praiamar Arena, Natal/RN. Inscrições abertas.",
    type: "website",
    locale: "pt_BR",
    siteName: "Hackathon do Sol",
    images: [{ url: "/imagens/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hackathon do Sol — 26 a 28 de junho",
    description:
      "Três dias de inovação, código e colaboração na Praiamar Arena.",
    images: ["/imagens/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
