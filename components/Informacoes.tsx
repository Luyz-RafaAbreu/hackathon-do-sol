import {
  CalendarDays,
  MapPin,
  Target,
  Zap,
  Trophy,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import Reveal from "./Reveal";
import TiltCard from "./TiltCard";

const items: {
  Icon: LucideIcon;
  title: string;
  text: string;
  cor: string;
}[] = [
  {
    Icon: CalendarDays,
    title: "Data",
    text: "26, 27 e 28 de junho de 2026 — três dias, da abertura ao pitch final.",
    cor: "from-sol-yellow to-sol-orange",
  },
  {
    Icon: MapPin,
    title: "Local",
    text: "Praiamar Arena — Av. Senador Salgado Filho, 1906, Lagoa Nova, Natal/RN.",
    cor: "from-sol-orange to-sol-pink",
  },
  {
    Icon: Target,
    title: "Público-alvo",
    text: "Desenvolvedores, designers, empreendedores e estudantes com interesse em inovação.",
    cor: "from-sol-pink to-sol-purpleLight",
  },
  {
    Icon: Zap,
    title: "Formato",
    text: "Presencial, em equipes de 4 pessoas, com mentorias técnicas ao longo do evento.",
    cor: "from-sol-purpleLight to-sol-teal",
  },
  {
    Icon: Trophy,
    title: "Premiação",
    text: "R$ 10 mil distribuídos entre as equipes vencedoras e visibilidade junto aos patrocinadores.",
    cor: "from-sol-teal to-sol-yellow",
  },
  {
    Icon: Handshake,
    title: "Comunidade",
    text: "Conexão com mentores, patrocinadores e outros profissionais da cena tech regional.",
    cor: "from-sol-yellow to-sol-pink",
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
            Os detalhes essenciais do evento em um só lugar — para você focar
            no que importa: criar.
          </p>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((i, idx) => (
          <Reveal key={i.title} delay={idx * 80}>
            <TiltCard className="card group h-full relative overflow-hidden">
              <div
                className={`absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r ${i.cor}`}
              />
              <div
                className={`absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br ${i.cor} opacity-15 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-25`}
              />
              <div className="relative">
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 mb-4 rounded-xl bg-gradient-to-br ${i.cor} shadow-[0_0.5rem_1.25rem_-0.5rem_rgba(255,140,0,0.5)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`}
                >
                  <i.Icon className="w-6 h-6 text-sol-bgDeep" strokeWidth={2.2} />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">
                  {i.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {i.text}
                </p>
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
