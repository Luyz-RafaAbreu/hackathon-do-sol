const keywords = [
  "INOVAÇÃO",
  "CÓDIGO",
  "CRIATIVIDADE",
  "IA",
  "NETWORKING",
  "DESIGN",
  "STARTUPS",
  "MENTORIAS",
  "COLABORAÇÃO",
  "PRÊMIOS",
];

export default function Marquee() {
  // duplicar a lista = loop perfeito com translateX(-50%)
  const items = [...keywords, ...keywords];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-sol-purple/40 via-sol-purpleLight/20 to-sol-purple/40 py-5 marquee-mask">
      <div className="marquee-track items-center">
        {items.map((k, i) => (
          <div
            key={i}
            className="flex items-center gap-10 md:gap-16 shrink-0 pr-10 md:pr-16"
          >
            <span className="font-display font-bold text-xl md:text-3xl text-white/80 whitespace-nowrap tracking-widest">
              {k}
            </span>
            <Star />
          </div>
        ))}
      </div>
    </div>
  );
}

function Star() {
  return (
    <svg
      className="w-5 h-5 md:w-6 md:h-6 text-sol-orange shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0l2.5 8.5L23 12l-8.5 2.5L12 24l-2.5-9.5L1 12l8.5-3.5L12 0z" />
    </svg>
  );
}
