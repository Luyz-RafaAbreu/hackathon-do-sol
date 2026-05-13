/** @type {import('next').NextConfig} */

// CSP é gerado no middleware (com nonce por request) — ver middleware.ts.
// Aqui ficam só os headers estáticos que valem pra todas as rotas, inclusive
// /api e assets estáticos que o middleware não cobre.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
module.exports = nextConfig;
