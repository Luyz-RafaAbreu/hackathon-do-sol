const keywords = [
  "INOVAÇÃO",
  "CÓDIGO",
  "DESIGN",
  "PRODUTO",
  "IA",
  "MENTORIAS",
  "PITCH",
  "NETWORKING",
  "COLABORAÇÃO",
  "PRÊMIOS",
];

export default function Marquee() {
  // duplicar a lista = loop perfeito com translateX(-50%)
  const items = [...keywords, ...keywords];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-sol-purple/50 via-sol-purpleLight/25 to-sol-purple/50 py-5 marquee-mask">
      {/* borda sutil dourada no topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sol-orange/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sol-pink/30 to-transparent" />

      <div className="marquee-track items-center">
        {items.map((k, i) => (
          <div
            key={i}
            className="flex items-center gap-10 md:gap-16 shrink-0 pr-10 md:pr-16"
          >
            <span className="font-display font-bold text-xl md:text-3xl text-white/85 whitespace-nowrap tracking-widest hover:text-sol-orange transition-colors duration-300 cursor-default">
              {k}
            </span>
            <Diamond index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Diamond({ index }: { index: number }) {
  // alterna cores pra criar variedade sutil
  const colors = ["text-sol-orange", "text-sol-yellow", "text-sol-pink", "text-sol-teal"];
  const color = colors[index % colors.length];
  return (
    <svg
      className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${color} drop-shadow-[0_0_0.5rem_currentColor]`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
    </svg>
  );
}
