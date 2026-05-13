import type { MetadataRoute } from "next";
import { EVENT } from "@/lib/event";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || EVENT.SITE_URL;

// Rotas públicas indexáveis. Não inclui /api (endpoint) nem rotas dinâmicas
// de OG/Twitter (assets, não páginas). Priority/changeFrequency são hints —
// o Google trata como sugestão, não regra.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/inscricao`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/termos-e-privacidade`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
