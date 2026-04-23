import Reveal from "./Reveal";

export default function Sobre() {
  return (
    <section id="sobre" className="section">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <Reveal>
          <span className="eyebrow">Sobre o evento</span>
          <h2 className="section-title">
            Onde <span className="text-gradient">ideias viram código</span> — e
            código vira impacto.
          </h2>
          <p className="text-white/75 leading-relaxed mb-4 text-[15px] md:text-base">
            O <strong className="text-white">Hackathon do Sol</strong> reúne
            desenvolvedores, designers e empreendedores em Natal para
            transformar desafios reais em soluções tecnológicas. São três dias
            de imersão, com equipes de quatro pessoas, mentorias ao longo do
            evento e pitches avaliados por uma banca no domingo.
          </p>
          <p className="text-white/75 leading-relaxed text-[15px] md:text-base">
            Mais que uma competição, é um ponto de encontro para quem constrói
            a próxima geração de produtos digitais no Nordeste. Ao final, as
            melhores equipes levam{" "}
            <strong className="text-sol-orange">R$ 10 mil em premiação</strong>{" "}
            e ganham visibilidade junto aos patrocinadores do evento.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={100 * i}>
              <div className="card text-center group relative overflow-hidden !p-5 md:!p-6">
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.cor}`}
                />
                <div
                  className={`absolute -top-14 -right-14 w-36 h-36 rounded-full bg-gradient-to-br ${s.cor} opacity-20 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-30`}
                />
                <div className="relative">
                  <div className="font-display font-black text-4xl md:text-5xl text-gradient leading-none tracking-tight transition-transform duration-500 group-hover:scale-105 whitespace-nowrap">
                    {s.value}
                  </div>
                  <div className="mt-3 text-[10px] md:text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                    {s.label}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: "3 dias", label: "de imersão", cor: "from-sol-yellow to-sol-orange" },
  { value: "160", label: "vagas", cor: "from-sol-orange to-sol-pink" },
  { value: "100%", label: "inscrição gratuita", cor: "from-sol-pink to-sol-purpleLight" },
  { value: "R$ 10 mil", label: "em premiação", cor: "from-sol-purpleLight to-sol-teal" },
];
