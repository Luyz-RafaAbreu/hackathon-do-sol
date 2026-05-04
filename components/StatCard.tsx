"use client";
import { useRef } from "react";
import { useCountUp } from "@/lib/hooks";
import TiltCard from "./TiltCard";

/**
 * Card de stat com número que conta de 0 ao valor final quando entra em
 * viewport. Mantém o tilt 3D e o gradiente de borda no topo.
 *
 * O texto final exibido é idêntico ao que estava antes (`{prefix}{value}{suffix}`),
 * só ganhou a animação de subida na chegada — sensação "carregando" rápida
 * e específica da estética tech que o overhaul busca.
 */
export default function StatCard({
  value,
  prefix = "",
  suffix = "",
  label,
  cor,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  cor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const animated = useCountUp(value, { ref, duration: 1600 });

  return (
    <TiltCard className="card text-center group relative overflow-hidden !p-4 sm:!p-5 md:!p-6">
      <div
        ref={ref}
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${cor}`}
      />
      <div
        className={`absolute -top-14 -right-14 w-36 h-36 rounded-full bg-gradient-to-br ${cor} opacity-20 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-30`}
      />
      <div className="relative">
        <div className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-gradient leading-none tracking-tight tabular-nums transition-transform duration-500 group-hover:scale-105 whitespace-nowrap">
          {prefix}
          {animated}
          {suffix}
        </div>
        <div className="mt-2 md:mt-3 font-mono text-[0.5625rem] sm:text-[0.625rem] md:text-xs font-medium uppercase tracking-[0.18em] md:tracking-[0.22em] text-white/65">
          {label}
        </div>
      </div>
    </TiltCard>
  );
}
