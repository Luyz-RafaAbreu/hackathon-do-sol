import Reveal from "./Reveal";

const patrocinadores = [
  { nome: "Programa Jovem Embaixador" },
  { nome: "Prefeitura de Natal" },
];

export default function Patrocinadores() {
  return (
    <section id="patrocinadores" className="section !py-16">
      <Reveal>
        <div className="text-center mb-10">
          <span className="eyebrow">Patrocínio</span>
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            Quem torna o{" "}
            <span className="bg-gradient-to-r from-sol-yellow to-sol-orange bg-clip-text text-transparent">
              Hackathon do Sol
            </span>{" "}
            possível
          </h2>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur overflow-hidden">
          {/* glow central sutil */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sol-orange/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[70%] h-32 bg-sol-pink/10 blur-3xl pointer-events-none" />

          <div className="relative p-6 md:p-12">
            <div className="flex flex-wrap items-center justify-center gap-5 md:gap-6">
              {patrocinadores.map((p, i) => (
                <div
                  key={i}
                  className="group h-20 min-w-[200px] px-8 flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-white/85 text-sm font-medium transition-all duration-500 hover:border-sol-orange/50 hover:from-white/[0.1] hover:text-white hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(255,140,0,0.4)]"
                >
                  <span className="font-display tracking-wide text-center leading-tight">
                    {p.nome}
                  </span>
                </div>
              ))}

              <a
                href="mailto:hackathondosol@gmail.com?subject=Proposta%20de%20patroc%C3%ADnio%20%E2%80%94%20Hackathon%20do%20Sol"
                className="group h-20 min-w-[200px] px-8 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sol-orange/40 bg-sol-orange/5 text-sol-orange text-sm font-semibold transition-all duration-500 hover:border-sol-orange hover:bg-sol-orange/10 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(255,140,0,0.5)]"
              >
                <span>Seja patrocinador</span>
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>

            <p className="text-center text-xs text-white/45 mt-8 max-w-xl mx-auto">
              Interessado em apoiar o evento? Escreva para{" "}
              <a
                href="mailto:hackathondosol@gmail.com"
                className="text-white/70 hover:text-sol-orange transition underline underline-offset-4 decoration-white/20 hover:decoration-sol-orange"
              >
                hackathondosol@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
