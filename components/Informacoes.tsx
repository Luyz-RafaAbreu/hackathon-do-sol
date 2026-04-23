import Reveal from "./Reveal";

const items = [
  {
    icon: "📅",
    title: "Data",
    text: "26, 27 e 28 de junho — três dias completos de imersão tecnológica.",
  },
  {
    icon: "📍",
    title: "Local",
    text: "Praiamar Arena — estrutura completa para participantes e mentores.",
  },
  {
    icon: "🎯",
    title: "Público-alvo",
    text: "Estudantes, desenvolvedores, designers, empreendedores e entusiastas de tecnologia.",
  },
  {
    icon: "⚡",
    title: "Formato",
    text: "Presencial, em equipes de 3 a 5 pessoas, com mentorias ao vivo.",
  },
  {
    icon: "🏆",
    title: "Benefícios",
    text: "Premiação, certificado, networking com empresas parceiras e visibilidade.",
  },
  {
    icon: "🤝",
    title: "Comunidade",
    text: "Acesso a uma rede de inovadores, mentores e patrocinadores após o evento.",
  },
];

export default function Informacoes() {
  return (
    <section id="informacoes" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Informações principais</span>
          <h2 className="section-title">Tudo que você precisa saber</h2>
          <p className="section-subtitle">
            Preparamos cada detalhe para que você possa focar no que importa:
            criar.
          </p>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((i, idx) => (
          <Reveal key={i.title} delay={idx * 80}>
            <div className="card group h-full">
              <div className="text-4xl mb-4 inline-block transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12">
                {i.icon}
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                {i.title}
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">{i.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
