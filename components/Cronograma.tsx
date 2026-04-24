import { Fragment } from "react";
import Reveal from "./Reveal";

const dias = [
  {
    data: "26 de junho — sexta-feira",
    numero: "01",
    titulo: "Dia 1 — Abertura",
    cor: "from-sol-yellow to-sol-pink",
    itens: [
      "09h00 — Credenciamento e entrega do kit do participante",
      "10h00 — Cerimônia de abertura",
      "11h00 — Palestra de boas-vindas",
      "12h00 — Almoço",
      "13h00 — Check-in no hotel",
      "14h00 — Início do desenvolvimento",
      "18h00 — Palestra",
      "19h00 — Jantar",
      "20h00 — Desenvolvimento em equipes",
    ],
  },
  {
    data: "27 de junho — sábado",
    numero: "02",
    titulo: "Dia 2 — Desenvolvimento",
    cor: "from-sol-pink to-sol-purpleLight",
    itens: [
      "06h00 — Café da manhã (até 08h00)",
      "09h00 — Palestra",
      "13h00 — Almoço",
      "14h00 — Desenvolvimento em equipes",
      "18h00 — Palestra",
      "19h00 — Jantar",
      "20h00 — Desenvolvimento em equipes",
    ],
  },
  {
    data: "28 de junho — domingo",
    numero: "03",
    titulo: "Dia 3 — Encerramento",
    cor: "from-sol-purpleLight to-sol-teal",
    itens: [
      "06h00 — Café da manhã (até 08h00)",
      "08h00 — Desenvolvimento em equipes",
      "12h00 — Checkout do hotel",
      "13h00 — Almoço",
      "14h00 — Avaliação dos projetos pela banca",
      "17h00 — Pitches finais das equipes",
      "18h00 — Cerimônia de encerramento e premiação",
      "19h00 — Confraternização de encerramento",
    ],
  },
];

export default function Cronograma() {
  return (
    <section id="cronograma" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Cronograma</span>
          <h2 className="section-title">Três dias, do kickoff ao pitch final</h2>
          <p className="section-subtitle">
            Uma agenda estruturada em blocos de desenvolvimento, palestras e
            pausas — pensada para manter o ritmo do evento.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {dias.map((d, i) => (
          <Reveal key={d.data} delay={i * 140}>
            <div className="card group relative overflow-hidden h-full">
              <div
                className={`absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r ${d.cor}`}
              />
              <div
                className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${d.cor} opacity-20 blur-2xl transition-all duration-700 group-hover:scale-125 group-hover:opacity-35`}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[0.625rem] md:text-xs uppercase tracking-[0.3em] text-sol-orange font-semibold">
                    {d.data}
                  </div>
                  <div
                    className={`font-display font-black text-5xl md:text-6xl bg-gradient-to-br ${d.cor} bg-clip-text text-transparent opacity-80 leading-none transition-transform duration-500 group-hover:scale-110`}
                  >
                    {d.numero}
                  </div>
                </div>
                <h3 className="font-display font-bold text-xl mb-5">
                  {d.titulo}
                </h3>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-baseline">
                  {d.itens.map((it) => {
                    const [hora, ...rest] = it.split(" — ");
                    const descricao = rest.join(" — ");
                    return (
                      <Fragment key={it}>
                        <dt className="font-display font-bold text-sol-orange tabular-nums whitespace-nowrap text-sm">
                          {hora}
                        </dt>
                        <dd className="text-sm text-white/85 leading-relaxed ml-0">
                          {descricao}
                        </dd>
                      </Fragment>
                    );
                  })}
                </dl>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
