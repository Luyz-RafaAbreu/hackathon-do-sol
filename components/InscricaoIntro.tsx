import { CalendarDays, MapPin, Users, Sparkles } from "lucide-react";
import Reveal from "./Reveal";
import { EVENT } from "@/lib/event";

/**
 * Intro centralizado da página /inscricao — emoldura o formulário com
 * presença sem virar hero gigante. Hierarquia: pill → brand line →
 * título grande → descrição → chips em pílulas.
 */
export default function InscricaoIntro() {
  const chips = [
    { Icon: CalendarDays, label: EVENT.DATE_RANGE_SHORT },
    { Icon: MapPin, label: EVENT.LOCATION_SHORT },
    { Icon: Users, label: `${EVENT.SLOTS} vagas` },
    { Icon: Sparkles, label: "100% gratuita" },
  ];

  return (
    <section className="relative px-6 md:px-10 max-w-3xl mx-auto pt-20 md:pt-24 pb-5 text-center">
      <Reveal>
        <div className="inline-flex items-center gap-2 mb-3 rounded-full bg-sol-orange/10 border border-sol-orange/30 px-3.5 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sol-orange" />
          </span>
          <span className="font-mono text-[0.625rem] md:text-[0.6875rem] uppercase tracking-[0.22em] text-sol-orange font-medium">
            Inscrições abertas
          </span>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <p className="font-mono text-[0.625rem] md:text-[0.6875rem] text-white/45 uppercase tracking-[0.32em] mb-2">
          {EVENT.NAME} · {EVENT.YEAR}
        </p>
        <h1 className="font-display font-bold text-3xl md:text-4xl leading-[1.05] tracking-tight mb-5">
          Inscreva-<span className="text-gradient-animated">se</span>
        </h1>
      </Reveal>

      <Reveal delay={120}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {chips.map(({ Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm"
            >
              <Icon className="w-3 h-3 text-sol-orange/90" strokeWidth={2.4} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
