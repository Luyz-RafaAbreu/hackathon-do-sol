import type { MetadataRoute } from "next";
import { EVENT } from "@/lib/event";

// Next gera /robots.txt a partir desse arquivo. `NEXT_PUBLIC_SITE_URL` ganha
// prioridade pra cobrir preview da Vercel; em produção cai pro SITE_URL fixo.
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || EVENT.SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api é endpoint, não conteúdo indexável.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
