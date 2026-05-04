"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * useCountUp — anima um valor de 0 ao target quando o ref entra em viewport.
 *
 * Pra dar a sensação clássica "número subindo" em stats: o usuário vê 0
 * quando rola até a seção, e em ~1.5s o número conta até o final. Respeita
 * prefers-reduced-motion (devolve direto o target).
 *
 * Curva ease-out exponencial — começa rápido, freia suave perto do fim.
 * Roda em RAF, sem timeouts/intervals.
 */
export function useCountUp(
  target: number,
  options: { duration?: number; ref?: RefObject<HTMLElement> } = {}
): number {
  const { duration = 1500, ref } = options;
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const el = ref?.current;
    if (!el) {
      // Sem ref: dispara imediatamente no mount (caso rápido).
      run();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (startedRef.current) return;
        for (const e of entries) {
          if (e.isIntersecting) {
            startedRef.current = true;
            run();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();

    function run() {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // ease-out exponencial — crescimento rápido, freio suave
        const eased = 1 - Math.pow(2, -10 * t);
        setValue(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, [target, duration, ref]);

  return value;
}

/**
 * useMagnetic — atrai um elemento na direção do cursor quando o cursor
 * está perto dele. Sensação "premium tech" em CTAs.
 *
 * O elemento move até `strength` pixels na direção do mouse, com lerp
 * suavizando. Volta ao centro suavemente quando o cursor sai do raio.
 * Desativa em touch e em prefers-reduced-motion.
 */
export function useMagnetic(strength = 18, radius = 90) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let active = false;
    let rafId = 0;

    const tick = () => {
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      el.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      if (
        active ||
        Math.abs(targetX - curX) > 0.05 ||
        Math.abs(targetY - curY) > 0.05
      ) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
        el.style.transform = "";
      }
    };

    const ensureLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        if (active) {
          active = false;
          targetX = 0;
          targetY = 0;
          ensureLoop();
        }
        return;
      }
      const pull = 1 - dist / radius;
      targetX = (dx / radius) * strength * pull;
      targetY = (dy / radius) * strength * pull;
      active = true;
      ensureLoop();
    };

    const onLeave = () => {
      active = false;
      targetX = 0;
      targetY = 0;
      ensureLoop();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [strength, radius]);

  return ref;
}
