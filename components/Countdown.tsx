"use client";
import { useEffect, useState } from "react";

// Evento: 26 de junho de 2026, 09h00 (horário de Brasília)
const TARGET = new Date("2026-06-26T09:00:00-03:00").getTime();

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setT(diff(TARGET)), 1000);
    return () => clearInterval(id);
  }, []);

  // evita hydration mismatch — só renderiza os números no client
  const items: [string, number][] = mounted
    ? [
        ["dias", t.days],
        ["horas", t.hours],
        ["min", t.minutes],
        ["seg", t.seconds],
      ]
    : [
        ["dias", 0],
        ["horas", 0],
        ["min", 0],
        ["seg", 0],
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
