import Reveal from "./Reveal";

const materiais = [
  {
    titulo: "Edital oficial",
    descricao: "Regras, critérios de avaliação e condições de participação.",
    icon: "📄",
  },
  {
    titulo: "Regulamento",
    descricao: "Normas de conduta, formação de equipes e uso da estrutura.",
    icon: "📘",
  },
  {
    titulo: "Guia do participante",
    descricao: "Dicas, cronograma detalhado e lista do que levar.",
    icon: "🎒",
  },
];

export default function Materiais() {
  return (
    <section id="materiais" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Materiais</span>
          <h2 className="section-title">Baixe os documentos do evento</h2>
          <p className="section-subtitle">
            Os documentos oficiais serão disponibilizados em breve. Fique
            atento às atualizações.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {materiais.map((m, i) => (
          <Reveal key={m.titulo} delay={i * 120}>
            <div className="card flex flex-col h-full relative opacity-90">
              <span className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.25em] font-semibold text-sol-orange bg-sol-orange/10 border border-sol-orange/30 rounded-full px-3 py-1">
                Em breve
              </span>
              <div className="text-4xl mb-4 inline-block">{m.icon}</div>
              <h3 className="font-display font-semibold text-lg mb-2">
                {m.titulo}
              </h3>
              <p className="text-white/70 text-sm flex-1 mb-4">{m.descricao}</p>
              <span className="inline-flex items-center gap-2 text-white/40 font-semibold text-sm cursor-not-allowed">
                Disponível em breve
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
