/**
 * Overlay de grain (ruído) cobrindo toda a viewport — adiciona textura
 * cinematográfica sutilíssima ao site, fugindo do "digital chapado".
 *
 * Implementação: SVG inline com filtro `feTurbulence` (gerador procedural
 * de ruído fractal embutido no navegador). Sem assets externos, sem requests.
 *
 * Reversibilidade: pra remover o efeito, basta apagar o `<GrainOverlay />`
 * em app/layout.tsx + esse arquivo. Zero side effect em outros lugares.
 */
export default function GrainOverlay() {
  const noiseSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
        <filter id='n'>
          <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/>
          <feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/>
        </filter>
        <rect width='100%' height='100%' filter='url(#n)'/>
      </svg>`
    );

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{
        backgroundImage: `url("${noiseSvg}")`,
        backgroundSize: "200px 200px",
        opacity: 0.06,
        mixBlendMode: "overlay",
      }}
    />
  );
}
