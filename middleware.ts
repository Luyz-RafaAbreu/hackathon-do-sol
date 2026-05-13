import { NextRequest, NextResponse } from "next/server";

// Cada request ganha um nonce aleatório (16 bytes, base64). O Next injeta esse
// nonce automaticamente nos <script> de hydration; pra inline scripts nossos,
// lemos via headers() e passamos via prop. `strict-dynamic` deixa scripts já
// confiáveis (com nonce) carregarem outros — é assim que Turnstile, Analytics
// e Speed Insights continuam funcionando sem precisar listar host por host.
//
// CSP de scripts antes era 'unsafe-inline' (decorativo). Agora bloqueia XSS
// inline de verdade.
export function middleware(request: NextRequest) {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' faz navegadores modernos ignorarem 'self' e a allowlist
    // de hosts em script-src — só scripts com nonce (ou carregados por um já
    // confiável) rodam. O host do Turnstile fica como fallback pra navegadores
    // antigos que não entendem strict-dynamic.
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'self'${isDev ? " 'unsafe-eval'" : ""}`,
    // style-src segue com 'unsafe-inline' — CSS injection é vetor muito mais
    // estreito (sem RCE) e Tailwind/styled-jsx dependem disso.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://servicodados.ibge.gov.br${isDev ? " ws: wss:" : ""}`,
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // O Next lê esse header pra descobrir o nonce e aplicar nos scripts de
  // hydration que ele mesmo injeta. Sem isso, a hydration quebra.
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Aplica em todas as rotas HTML. Exclui /api (JSON, sem script), assets
    // estáticos do Next, favicon, /imagens e arquivos de SEO.
    // `missing` desliga pra prefetches do router (não renderizam HTML).
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|imagens|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
