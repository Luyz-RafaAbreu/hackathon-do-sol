"use client";
import { useEffect, useRef, ReactNode } from "react";

/**
 * Card com tilt 3D + shine que segue o cursor.
 *
 * Wraps qualquer conteúdo num <div> com a className passada (geralmente
 * "card group ..."). No hover, calcula a posição do cursor relativa ao
 * centro do card e aplica rotação 3D suave (max 5° em cada eixo) + um
 * brilho radial que aparece sob o cursor.
 *
 *  - Lerp por frame (RAF) → movimento suave mesmo com mouse trêmulo
 *  - translateZ(8px) no estado ativo "puxa" o card pra frente em 3D
 *  - Desativado em touch/coarse pointer (sem cursor, sem efeito) e em
 *    prefers-reduced-motion (acessibilidade)
 *
 * IMPORTANTE: o container (.card) precisa ter `overflow-hidden` pro shine
 * ser clipado dentro do border-radius. Todos os usos atuais já têm.
 */
type Props = {
  children: ReactNode;
  className?: string;
};

const MAX_ROT = 5;

export default function TiltCard({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const shineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    const shine = shineRef.current;
    if (!el || !shine) return;

    let targetRotX = 0; // rotação em torno do eixo X (tilt vertical, vem do cursor Y)
    let targetRotY = 0; // rotação em torno do eixo Y (tilt horizontal, vem do cursor X)
    let curRotX = 0;
    let curRotY = 0;
    let targetSx = 50; // posição do shine em %
    let targetSy = 50;
    let curSx = 50;
    let curSy = 50;
    let active = false;
    let rafId = 0;

    const tick = () => {
      const k = 0.14;
      curRotX += (targetRotX - curRotX) * k;
      curRotY += (targetRotY - curRotY) * k;
      curSx += (targetSx - curSx) * k;
      curSy += (targetSy - curSy) * k;

      const tz = active ? 8 : 0;
      el.style.transform = `perspective(1000px) rotateX(${curRotX}deg) rotateY(${curRotY}deg) translateZ(${tz}px)`;
      shine.style.background = `radial-gradient(circle at ${curSx}% ${curSy}%, rgba(255,255,255,0.15), transparent 55%)`;
      shine.style.opacity = active ? "1" : "0";

      const stillMoving =
        Math.abs(targetRotX - curRotX) > 0.01 ||
        Math.abs(targetRotY - curRotY) > 0.01;

      if (active || stillMoving) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
        // Limpa o transform inline pra deixar o CSS de hover (border, glow,
        // etc.) reassumir naturalmente caso o cursor saia.
        el.style.transform = "";
      }
    };

    const ensureLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      const y = (e.clientY - rect.top) / rect.height;
      targetRotY = (x - 0.5) * 2 * MAX_ROT; // cursor à direita ⇒ rotaciona pra direita
      targetRotX = -(y - 0.5) * 2 * MAX_ROT; // cursor em cima ⇒ inclina pra trás
      targetSx = x * 100;
      targetSy = y * 100;
      active = true;
      ensureLoop();
    };

    const onLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
      active = false;
      ensureLoop();
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
      <div
        ref={shineRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          transition: "opacity 0.25s",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
