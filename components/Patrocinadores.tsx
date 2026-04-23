import Reveal from "./Reveal";

const patrocinadores = [
  { nome: "Programa Jovem Embaixador" },
  { nome: "Prefeitura de Natal" },
  { nome: "Patrocinador" },
  { nome: "Patrocinador" },
  { nome: "Patrocinador" },
];

export default function Patrocinadores() {
  return (
    <section id="patrocinadores" className="section !py-16">
      <Reveal>
        <div className="text-center mb-8">
          <span className="eyebrow">Patrocínio</span>
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            Quem torna o Hackathon do Sol possível
          </h2>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-6 md:p-10 overflow-hidden">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[60%] h-20 bg-sol-orange/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-center gap-5 md:gap-8">
            {patrocinadores.map((p, i) => (
              <div
                key={i}
                className="h-16 min-w-[150px] px-6 flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 text-sm font-medium transition-all duration-300 hover:border-sol-orange/50 hover:bg-white/[0.08] hover:text-white hover:-translate-y-1"
              >
                {p.nome}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-white/40 mt-6">
            Substitua estes blocos pelos logos reais em{" "}
            <code className="text-white/60">components/Patrocinadores.tsx</code>.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
