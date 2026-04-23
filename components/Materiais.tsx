import Reveal from "./Reveal";

const materiais = [
  {
    titulo: "Edital oficial",
    descricao: "Regras, critérios de avaliação e condições de participação.",
    icon: "📄",
    cor: "from-sol-yellow to-sol-orange",
  },
  {
    titulo: "Regulamento",
    descricao: "Normas de conduta, formação de equipes e uso da estrutura.",
    icon: "📘",
    cor: "from-sol-orange to-sol-pink",
  },
  {
    titulo: "Guia do participante",
    descricao: "Dicas, cronograma detalhado e lista do que levar.",
    icon: "🎒",
    cor: "from-sol-pink to-sol-purpleLight",
  },
];

export default function Materiais() {
  return (
    <section id="materiais" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Materiais</span>
          <h2 className="section-title">Documentos oficiais do evento</h2>
          <p className="section-subtitle">
            Edital, regulamento e guia do participante serão publicados antes
            da abertura. Acompanhe o{" "}
            <a
              href="https://instagram.com/hackathondosol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sol-orange hover:underline"
            >
              @hackathondosol
            </a>{" "}
            para ser avisado.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {materiais.map((m, i) => (
          <Reveal key={m.titulo} delay={i * 120}>
            <div className="card group h-full relative overflow-hidden flex flex-col">
              {/* listra gradiente no topo */}
              <div
                className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${m.cor}`}
              />
              {/* blob decorativo */}
              <div
                className={`absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br ${m.cor} opacity-10 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-20`}
              />

              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl inline-block transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    {m.icon}
                  </div>
                  <span className="relative inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] font-semibold text-sol-orange bg-sol-orange/10 border border-sol-orange/30 rounded-full px-3 py-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sol-orange" />
                    </span>
                    Em breve
                  </span>
                </div>

                <h3 className="font-display font-semibold text-lg mb-2">
                  {m.titulo}
                </h3>
                <p className="text-white/65 text-sm flex-1 mb-5 leading-relaxed">
                  {m.descricao}
                </p>

                <span className="inline-flex items-center gap-2 text-white/35 font-semibold text-sm cursor-not-allowed pt-3 border-t border-white/[0.06]">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  Disponível em breve
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
