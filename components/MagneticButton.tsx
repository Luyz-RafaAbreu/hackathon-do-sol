"use client";
import { type ReactNode } from "react";
import { useMagnetic } from "@/lib/hooks";

/**
 * Wrapper que aplica o efeito magnético no elemento filho — o botão atrai
 * o cursor sutilmente quando ele está dentro do raio definido. Usar nos
 * CTAs principais (Hero, Header, Submit) pra dar sensação "premium".
 */
export default function MagneticButton({
  children,
  strength = 14,
  radius = 100,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = useMagnetic(strength, radius);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={`inline-block will-change-transform ${className}`}>
      {children}
    </div>
  );
}
