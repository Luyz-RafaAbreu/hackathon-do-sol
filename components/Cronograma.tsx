import Reveal from "./Reveal";

const dias = [
  {
    data: "26 de junho",
    numero: "01",
    titulo: "Dia 1 — Abertura",
    cor: "from-sol-yellow to-sol-pink",
    itens: [
      "09h — Credenciamento",
      "10h — Cerimônia de abertura",
      "11h — Apresentação dos desafios",
      "14h — Formação de equipes",
      "16h — Kick-off oficial",
    ],
  },
  {
    data: "27 de junho",
    numero: "02",
    titulo: "Dia 2 — Desenvolvimento",
    cor: "from-sol-pink to-sol-purpleLight",
    itens: [
      "Sessões de mentoria ao longo do dia",
      "Workshops técnicos paralelos",
      "Coffee breaks e networking",
      "Hacking noturno liberado",
    ],
  },
  {
    data: "28 de junho",
    numero: "03",
    titulo: "Dia 3 — Apresentações",
    cor: "from-sol-purpleLight to-sol-teal",
    itens: [
      "09h — Entrega das soluções",
      "11h — Pitches finais",
      "15h — Avaliação da banca",
      "17h — Premiação e encerramento",
    ],
  },
];

export default function Cronograma() {
  return (
    <section id="cronograma" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Cronograma</span>
          <h2 className="section-title">72 horas, três dias de energia</h2>
          <p className="section-subtitle">
            Uma agenda pensada para equilibrar criação, aprendizado e descanso.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {dias.map((d, i) => (
          <Reveal key={d.data} delay={i * 140}>
            <div className="card relative overflow-hidden h-full">
              <div
                className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${d.cor} opacity-25 blur-2xl transition-all duration-700 group-hover:scale-125`}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-sol-orange">
                    {d.data}
                  </div>
                  <div
                    className={`font-display font-black text-5xl bg-gradient-to-br ${d.cor} bg-clip-text text-transparent opacity-70`}
                  >
                    {d.numero}
                  </div>
                </div>
                <h3 className="font-display font-bold text-xl mb-4">
                  {d.titulo}
                </h3>
                <ul className="space-y-2.5">
                  {d.itens.map((it) => (
                    <li
                      key={it}
                      className="text-sm text-white/75 flex items-start gap-2"
                    >
                      <span className="text-sol-orange mt-1">▸</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
