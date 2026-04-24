"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Sol com halos concêntricos, raios triangulares finos, núcleo pulsante e planeta orbitando
const RAY_COUNT = 24;

function SolZero() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full overflow-visible"
      aria-hidden
    >
      <defs>
        <radialGradient id="nf-sol-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7d4" />
          <stop offset="35%" stopColor="#ffd34f" />
          <stop offset="75%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ff6b00" />
        </radialGradient>
        <radialGradient id="nf-sol-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8c00" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#e879f9" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nf-sol-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fff7d4" />
          <stop offset="100%" stopColor="#ffd34f" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* halo externo difuso */}
      <circle cx="60" cy="60" r="58" fill="url(#nf-sol-halo)" />

      {/* anel pontilhado externo — rotação lenta */}
      <g style={{ transformOrigin: "60px 60px" }}>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="#ffc830"
          strokeWidth="0.6"
          strokeDasharray="1.2 2.4"
          opacity="0.55"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 60"
            to="360 60 60"
            dur="40s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      {/* raios triangulares finos */}
      <g>
        {Array.from({ length: RAY_COUNT }).map((_, i) => {
          const deg = (360 / RAY_COUNT) * i;
          return (
            <path
              key={i}
              transform={`rotate(${deg} 60 60)`}
              d="M 60 6 L 58.5 18 L 61.5 18 Z"
              fill="#ff8c00"
              opacity="0.85"
            />
          );
        })}
      </g>

      {/* anel sólido interno */}
      <circle
        cx="60"
        cy="60"
        r="40"
        fill="none"
        stroke="#ff8c00"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* corpo principal */}
      <circle cx="60" cy="60" r="32" fill="url(#nf-sol-core)" />

      {/* brilho central pulsante */}
      <circle cx="60" cy="60" r="10" fill="url(#nf-sol-center)">
        <animate
          attributeName="r"
          values="9;12;9"
          dur="3.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.85;1;0.85"
          dur="3.5s"
          repeatCount="indefinite"
        />
      </circle>

      {/* planeta orbitando — detalhe */}
      <g style={{ transformOrigin: "60px 60px" }}>
        <circle cx="60" cy="10" r="1.8" fill="#e879f9" opacity="0.9">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 60"
            to="360 60 60"
            dur="14s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}

// Data do evento — 26 jun 2026 09:00 BRT
const EVENT_DATE_MS = new Date("2026-06-26T09:00:00-03:00").getTime();

function daysUntilEvent(): number {
  const diff = EVENT_DATE_MS - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function NotFoundHero() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sunParallaxRef = useRef<HTMLDivElement | null>(null);
  const [days, setDays] = useState<number | null>(null);

  // countdown — client-side pra evitar mismatch SSR
  useEffect(() => {
    setDays(daysUntilEvent());
  }, []);

  // parallax suave do sol acompanhando o mouse — sensação de profundidade
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scene = sceneRef.current;
    const sun = sunParallaxRef.current;
    if (!scene || !sun) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let active = false;

    const tick = () => {
      // lerp — suaviza e dá inércia
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      const dist = 1.5 * rem;

      sun.style.transform = `translate3d(${currentX * dist}px, ${currentY * dist}px, 0)`;

      if (active || Math.abs(currentX) > 0.002 || Math.abs(currentY) > 0.002) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    const ensureLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = scene.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      active = true;
      ensureLoop();
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      active = false;
      ensureLoop();
    };

    scene.addEventListener("mousemove", onMove);
    scene.addEventListener("mouseleave", onLeave);

    return () => {
      scene.removeEventListener("mousemove", onMove);
      scene.removeEventListener("mouseleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // tecla ESC volta pra home — atalho de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.location.href = "/";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={sceneRef} className="max-w-3xl w-full text-center mx-auto">
      {/* 404 display */}
      <div
        className="relative inline-flex items-center gap-2 sm:gap-3 md:gap-5 lg:gap-6 mb-4 sm:mb-6 md:mb-7 lg:mb-9 h-short:mb-4"
        role="img"
        aria-label="Erro 404"
      >
        {/* linha de horizonte atrás — sugestão de pôr do sol */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-px bg-gradient-to-r from-transparent via-sol-orange/40 to-transparent"
        />

        {/* glow difuso por trás */}
        <div
          aria-hidden
          className="absolute -inset-10 md:-inset-16 bg-gradient-to-r from-sol-orange/20 via-sol-pink/25 to-sol-purpleLight/20 blur-3xl opacity-70 -z-10"
        />

        <span
          className="relative font-display font-black text-[6rem] sm:text-[9rem] md:text-[11rem] lg:text-[13rem] h-short:text-[9rem] leading-none tracking-tighter text-gradient-animated animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          4
        </span>

        {/* sol — wrapper externo faz parallax (JS transform), wrapper interno faz entry (CSS) */}
        <div
          ref={sunParallaxRef}
          className="relative w-[6rem] h-[6rem] sm:w-[9rem] sm:h-[9rem] md:w-[11rem] md:h-[11rem] lg:w-[13rem] lg:h-[13rem] h-short:w-[9rem] h-short:h-[9rem] shrink-0"
          style={{
            transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: "transform",
          }}
        >
          <div className="w-full h-full animate-sun-entry">
            <SolZero />
          </div>
        </div>

        <span
          className="relative font-display font-black text-[6rem] sm:text-[9rem] md:text-[11rem] lg:text-[13rem] h-short:text-[9rem] leading-none tracking-tighter text-gradient-animated animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          4
        </span>
      </div>

      {/* copy */}
      <div className="animate-fade-up" style={{ animationDelay: "320ms" }}>
        <span className="eyebrow justify-center">Rota desconhecida</span>
        <h1 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-3 md:mb-4">
          Essa página se perdeu no{" "}
          <span className="text-gradient">pôr do sol</span>
        </h1>
        <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-xl mx-auto mb-6 md:mb-8">
          A rota que você tentou acessar ficou pra trás do horizonte. Mas o
          sol ainda não se pôs —{" "}
          {days !== null ? (
            <>
              faltam{" "}
              <strong className="font-semibold text-gradient">
                {days} {days === 1 ? "dia" : "dias"}
              </strong>{" "}
              pra abertura, na Praiamar Arena, em Natal/RN.
            </>
          ) : (
            <>
              o evento acontece de 26 a 28 de junho, na Praiamar Arena, em
              Natal/RN.
            </>
          )}
        </p>
      </div>

      {/* CTA */}
      <div
        className="flex items-center justify-center animate-fade-up"
        style={{ animationDelay: "440ms" }}
      >
        <Link href="/" className="btn-primary text-sm md:text-base">
          <span aria-hidden>←</span> Voltar ao início
        </Link>
      </div>

      {/* atalho de teclado */}
      <p
        className="mt-4 md:mt-6 text-xs text-white/35 animate-fade-up"
        style={{ animationDelay: "560ms" }}
      >
        Ou pressione{" "}
        <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-white/20 bg-white/5 font-mono text-[0.65rem] text-white/55 ml-0.5">
          Esc
        </kbd>
      </p>
    </div>
  );
}
