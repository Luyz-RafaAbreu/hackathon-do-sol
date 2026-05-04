"use client";
import { useEffect, useRef } from "react";

/**
 * Cursor custom contextual — muda de forma conforme o elemento sob o mouse.
 *
 * 4 shapes (SVG), todas no DOM, uma visível por vez via classe `.mode-*`:
 *   - arrow   → default (padrão em áreas não interativas)
 *   - hand    → sobre links, botões, elementos clicáveis
 *   - text    → I-beam sobre campos de texto (input, textarea, contenteditable)
 *   - loading → spinner sobre elementos com aria-busy="true"
 *
 * Override manual: adicione `data-cursor="hand|text|loading|arrow"` em qualquer
 * elemento para forçar um modo específico.
 *
 * Cada shape tem seu hotspot calibrado via `top`/`left` negativo — ponto clicável
 * sempre fica alinhado com o pixel do mouse independentemente da forma ativa.
 */

const MODES = ["arrow", "hand", "text", "loading"] as const;
type Mode = (typeof MODES)[number];

export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;

    document.body.classList.add("has-custom-cursor");

    const setMode = (mode: Mode) => {
      for (const m of MODES) {
        el.classList.toggle(`mode-${m}`, m === mode);
      }
    };

    const onMove = (e: MouseEvent) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      el.style.opacity = "1";
    };

    const onOver = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // override explícito via data-cursor
      const override = target.closest<HTMLElement>("[data-cursor]")?.dataset
        .cursor as Mode | undefined;
      if (override && (MODES as readonly string[]).includes(override)) {
        setMode(override);
        return;
      }

      // aria-busy → loading
      if (target.closest('[aria-busy="true"]')) {
        setMode("loading");
        return;
      }

      // campos de texto → I-beam
      if (
        target.closest(
          'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="range"]), textarea, [contenteditable="true"]'
        )
      ) {
        setMode("text");
        return;
      }

      // elementos interativos → pulse (sem label — labels em formulários são ruído visual)
      if (
        target.closest(
          'a, button, select, summary, [role="button"], [tabindex]:not([tabindex="-1"])'
        )
      ) {
        setMode("hand");
        return;
      }

      setMode("arrow");
    };

    const hide = () => {
      el.style.opacity = "0";
    };
    const onDown = () => el.classList.add("is-click");
    const onUp = () => el.classList.remove("is-click");

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", hide);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <>
      {/* defs compartilhado — gradientes acessíveis pelos SVGs do cursor via url(#id) */}
      <svg
        width="0"
        height="0"
        aria-hidden
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        <defs>
          <linearGradient id="cc-fill" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="cc-highlight" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div ref={ref} aria-hidden className="cursor-cc mode-arrow">
        {/* Seta — hotspot em (2, 2) */}
        <svg viewBox="0 0 24 24" className="cc-shape cc-arrow">
          <path
            d="M 2 2 L 2 18 L 5.5 15 L 8 21 L 10 20 L 7.5 14.5 L 14 14 Z"
            fill="url(#cc-fill)"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M 3 2.5 L 3 8 L 5.5 5.5 Z" fill="url(#cc-highlight)" />
        </svg>

        {/* Zona clicável — 3 camadas:
            1. halo contínuo (breathe) — presença constante
            2. duas ondas expansivas (ripple) — movimento
            3. seta ganha glow extra via CSS seletor */}
        <div className="cc-aura" aria-hidden />
        <div className="cc-pulse cc-pulse-1" aria-hidden />
        <div className="cc-pulse cc-pulse-2" aria-hidden />

        {/* I-beam (seletor de texto) — hotspot no centro (12, 12) */}
        <svg viewBox="0 0 24 24" className="cc-shape cc-text">
          <g
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="9" y1="5" x2="15" y2="5" />
            <line x1="9" y1="19" x2="15" y2="19" />
          </g>
        </svg>

        {/* Loading (bolinha carregando) — hotspot no centro (12, 12) */}
        <svg viewBox="0 0 24 24" className="cc-shape cc-loading">
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="2.2"
          />
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="rgba(255, 255, 255, 0.95)"
            strokeWidth="2.2"
            strokeDasharray="20 30"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>
    </>
  );
}
