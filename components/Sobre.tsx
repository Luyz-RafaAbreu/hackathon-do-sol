import Reveal from "./Reveal";
import StatCard from "./StatCard";

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
          <p className="text-white/75 leading-relaxed mb-4 text-[0.9375rem] md:text-base">
            O <strong className="text-white">Hackathon do Sol</strong> reúne
            desenvolvedores, designers e empreendedores em Natal para
            transformar desafios reais em soluções tecnológicas. São três dias
            de imersão, com equipes de quatro pessoas, mentorias ao longo do
            evento e pitches avaliados por uma banca no domingo.
          </p>
          <p className="text-white/75 leading-relaxed text-[0.9375rem] md:text-base">
            Mais que uma competição, é um ponto de encontro para quem constrói
            a próxima geração de produtos digitais no Nordeste. Ao final, as
            melhores equipes levam{" "}
            <strong className="text-sol-orange">R$ 10 mil em premiação</strong>{" "}
            e ganham visibilidade junto aos patrocinadores do evento.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={100 * i}>
              <StatCard
                value={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                label={s.label}
                cor={s.cor}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// Valor numérico separado de prefix/suffix — permite o counter animar só o
// número. Texto final renderizado é idêntico ao original ("3 dias", "160",
// "100%", "R$ 10 mil").
const stats: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  cor: string;
}[] = [
  { value: 3, suffix: " dias", label: "de imersão", cor: "from-sol-yellow to-sol-orange" },
  { value: 160, label: "vagas", cor: "from-sol-orange to-sol-pink" },
  { value: 100, suffix: "%", label: "inscrição gratuita", cor: "from-sol-pink to-sol-purpleLight" },
  { value: 10, prefix: "R$ ", suffix: " mil", label: "em premiação", cor: "from-sol-purpleLight to-sol-teal" },
];
