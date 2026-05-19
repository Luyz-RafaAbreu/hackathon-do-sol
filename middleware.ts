import { NextRequest, NextResponse } from "next/server";

// Cada request ganha um nonce aleatório (16 bytes, base64). O Next injeta esse
// nonce automaticamente nos <script> de hydration; pra inline scripts nossos,
// lemos via headers() e passamos via prop. `strict-dynamic` deixa scripts já
// confiáveis (com nonce) carregarem outros — é assim que Turnstile, Analytics
// e Speed Insights continuam funcionando sem precisar listar host por host.
//
// CSP de scripts antes era 'unsafe-inline' (decorativo). Agora bloqueia XSS
// inline de verdade.
//
// Auth não é gateada no middleware — o gate é em /inscricao server component
// (mostra modal de login sobreposto se não tem sessão). Segurança real fica
// em /api/draft e /api/inscricao, que checam sessão antes de processar.
export function middleware(request: NextRequest) {
  // Acesso temporariamente liberado no alias .vercel.app pra compartilhar
  // prévia do site (chefe + grupo confiável). O 404 anterior foi removido
  // quando essa decisão foi tomada — restaurar quando o domínio próprio
  // entrar, pra evitar que o Google indexe URLs duplicadas .vercel.app +
  // hackathondosol.com.br competindo por SEO.
  //
  // Enquanto isso, o `noindex` abaixo cobre o gap: pessoas que recebem o
  // link entram, mas o Google não indexa.
  const host = request.headers.get("host") ?? "";
  const isVercelAlias = host.endsWith(".vercel.app");

  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' faz navegadores modernos ignorarem o allowlist —
    // só scripts com nonce (ou carregados por um já confiável) rodam.
    // O allowlist é fallback pra navegadores antigos que não entendem
    // strict-dynamic. Allowlist explícito (sem `https:` aberto) pra que
    // browsers legados não aceitem script de qualquer HTTPS:
    //   - Turnstile (captcha do form)
    //   - Vercel Analytics
    //   - Vercel Speed Insights
    `script-src 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://*.vercel-scripts.com https://*.vercel-insights.com 'self'${isDev ? " 'unsafe-eval'" : ""}`,
    // style-src segue com 'unsafe-inline' — CSS injection é vetor muito mais
    // estreito (sem RCE) e Tailwind/styled-jsx dependem disso.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // googleusercontent.com hospeda a foto de perfil do Google OAuth.
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    `connect-src 'self' https://servicodados.ibge.gov.br${isDev ? " ws: wss:" : ""}`,
    // Turnstile renderiza o widget de captcha em iframe — único frame
    // permitido. OAuth Google é popup (window.open), não precisa de
    // frame-src.
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // form-action precisa permitir accounts.google.com pra que o redirect
    // de OAuth pro Google funcione (alguns navegadores tratam o redirect
    // POST do NextAuth como form submission).
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // O Next lê esse header pra descobrir o nonce e aplicar nos scripts de
  // hydration que ele mesmo injeta. Sem isso, a hydration quebra.
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);

  // No alias .vercel.app, instrui crawlers a NÃO indexar. Cobre o gap até o
  // domínio próprio entrar — sem isso, o Google indexaria o .vercel.app e
  // depois apareceriam dois resultados competindo por SEO.
  if (isVercelAlias) {
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  // Cobre praticamente tudo (inclusive /api, /robots.txt, /sitemap.xml e
  // /imagens/*) pra que o noindex pegue de verdade no alias .vercel.app.
  // Excluídos só os assets imutáveis do Next, que têm nomes hash-eados e
  // não vazam conteúdo sem acesso prévio à página.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
