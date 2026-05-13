import type { MetadataRoute } from "next";
import { EVENT } from "@/lib/event";

// Web App Manifest — usado quando o usuário "adiciona à tela inicial" no
// celular. Define nome do app, cores da splash screen, ícones. Sem isso, o
// atalho fica genérico (cinza, sem cor, nome truncado).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: EVENT.NAME,
    short_name: EVENT.NAME,
    description: `${EVENT.DATE_RANGE_LONG} em ${EVENT.CITY_STATE}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#1a0b3d", // sol.bg — splash screen quando abre como app instalado
    theme_color: "#1a0b3d", // sol.bg — combina com o tom de chrome do navegador (mesma cor do <meta name="theme-color">)
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
