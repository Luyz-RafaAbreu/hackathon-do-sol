"use client";
import { useEffect, useState } from "react";
import { EVENT } from "@/lib/event";

const TARGET = EVENT.START_DATE.getTime();
const END_TARGET = EVENT.END_DATE.getTime();

type Phase = "pre" | "during" | "post";

function getPhase(now: number): Phase {
  if (now < TARGET) return "pre";
  if (now <= END_TARGET) return "during";
  return "post";
}

function diff(to: number) {
  const now = Date.now();
  const ms = Math.max(0, to - now);
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export default function Countdown() {
  const [t, setT] = useState(() => diff(TARGET));
  const [phase, setPhase] = useState<Phase>(() => getPhase(Date.now()));

  useEffect(() => {
    // Pausa o tick quando a aba fica oculta — sem isso, gastamos um setInterval
    // por segundo de bateria do usuário sem ninguém ver. Ao voltar, atualizamos
    // imediatamente pra cobrir o tempo que passou enquanto a aba estava parada.
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      setPhase(getPhase(Date.now()));
      setT(diff(TARGET));
    };

    const start = () => {
      if (id !== null) return;
      tick();
      id = setInterval(tick, 1000);
    };

    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  // Pré-evento: contagem regressiva clássica.
  // suppressHydrationWarning nos números — server renderiza com server-time,
  // client com client-time (diferem em ms). Sem isso teria hydration mismatch
  // ou seria preciso flashar zeros até montar (visualmente ruim).
  if (phase === "pre") {
    const items: [string, number][] = [
      ["dias", t.days],
      ["horas", t.hours],
      ["min", t.minutes],
      ["seg", t.seconds],
    ];

    return (
      <div className="flex items-center justify-center gap-1.5 md:gap-3">
        {items.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-1.5 md:gap-3">
            <div className="flex flex-col items-center min-w-[3.25rem] md:min-w-[4.75rem]">
              <div className="relative w-full rounded-xl border border-white/15 bg-white/5 backdrop-blur px-2.5 py-2 md:px-4 md:py-3 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-sol-orange/10 via-transparent to-sol-pink/10" />
                <div
                  key={value}
                  className="relative font-display font-bold text-2xl md:text-4xl text-white text-center tabular-nums animate-fade-up"
                  suppressHydrationWarning
                >
                  {String(value).padStart(2, "0")}
                </div>
              </div>
              <div className="mt-1.5 text-[0.5625rem] md:text-[0.6875rem] uppercase tracking-[0.25em] text-white/60">
                {label}
              </div>
            </div>
            {i < items.length - 1 && (
              <div className="text-sol-orange text-xl md:text-2xl font-bold -mt-4">
                :
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Durante o evento: card celebrativo com gradiente animado e glow forte.
  // Mantém a "presença" visual da contagem regressiva, mas em vez de números
  // mostra que o evento está rolando agora.
  if (phase === "during") {
    return (
      <div className="flex items-center justify-center">
        <div className="relative rounded-xl border-2 border-sol-orange/50 bg-white/5 backdrop-blur px-6 py-4 md:px-10 md:py-5 overflow-hidden shadow-[0_0_2.5rem_-0.5rem_rgba(255,140,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-br from-sol-orange/20 via-sol-pink/10 to-sol-yellow/20 animate-pulse-slow" />
          <div className="relative text-center">
            <div className="font-display font-bold text-2xl md:text-4xl text-gradient-animated leading-tight">
              Acontecendo agora
            </div>
            <div className="mt-2 font-mono text-[0.625rem] md:text-[0.6875rem] uppercase tracking-[0.25em] text-white/70">
              Estamos vivendo isso
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pós-evento: tom calmo, sem gradiente animado. Comunica que a edição
  // terminou e deixa um gancho pra próxima.
  return (
    <div className="flex items-center justify-center">
      <div className="relative rounded-xl border border-white/15 bg-white/5 backdrop-blur px-6 py-4 md:px-10 md:py-5">
        <div className="text-center">
          <div className="font-display font-bold text-xl md:text-3xl text-white/85 leading-tight">
            Edição {EVENT.YEAR} encerrada
          </div>
          <div className="mt-2 font-mono text-[0.625rem] md:text-[0.6875rem] uppercase tracking-[0.25em] text-white/50">
            Até a próxima
          </div>
        </div>
      </div>
    </div>
  );
}
