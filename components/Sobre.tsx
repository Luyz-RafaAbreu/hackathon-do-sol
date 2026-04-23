import Reveal from "./Reveal";

export default function Sobre() {
  return (
    <section id="sobre" className="section">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <Reveal>
          <span className="eyebrow">Sobre o evento</span>
          <h2 className="section-title">
            Onde <span className="text-gradient">ideias viram código</span> e
            código vira impacto.
          </h2>
          <p className="text-white/75 leading-relaxed mb-4">
            O <strong>Hackathon do Sol</strong> é um encontro de mentes
            criativas, desenvolvedores, designers e empreendedores que
            acreditam no poder da tecnologia para transformar o mundo. Durante
            três dias intensos, participantes se reúnem para resolver desafios
            reais com soluções inovadoras.
          </p>
          <p className="text-white/75 leading-relaxed">
            Mais do que uma competição, é uma experiência de colaboração,
            aprendizado e networking, criando um ecossistema único onde a
            próxima grande ideia pode nascer.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={100 * i}>
              <div className="card text-center group">
                <div className="font-display font-bold text-3xl md:text-4xl text-gradient transition-transform duration-500 group-hover:scale-110">
                  {s.value}
                </div>
                <div className="text-sm text-white/60 mt-2">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: "72h", label: "de imersão" },
  { value: "+200", label: "participantes" },
  { value: "+15", label: "mentores" },
  { value: "R$ 30k", label: "em premiação" },
];
