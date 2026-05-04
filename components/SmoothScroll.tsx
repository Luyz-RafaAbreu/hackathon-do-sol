"use client";
import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scroll com Lenis — adiciona inércia suave ao scroll da página.
 *
 * Lenis intercepta o evento de wheel/touch e anima o scroll em vez de aplicar
 * direto. Isso dá a sensação de "scroll com peso" característica de sites
 * premium (Awwwards, Apple, etc).
 *
 * Coordenação com outros componentes:
 *  - `CustomScrollbar` lê `window.__lenis` e chama `.stop()`/`.start()` durante
 *    o drag pra Lenis não interferir com a posição direta que o drag escreve.
 *  - `globals.css` removeu `scroll-behavior: smooth` — Lenis assume o controle;
 *    deixar o CSS ligado causa double-easing nos anchors.
 *  - Reduced-motion: pula o componente inteiro, scroll volta a ser nativo.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      // ease-out exponencial — começa rápido, freia suave no final
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // touch já fica suave por padrão; valor < 1 desacelera, > 1 acelera
      touchMultiplier: 1.4,
      // Intercepta clicks em <a href="#anchor"> pra usar a mesma curva.
      // Sem isso, anchors saltavam instantaneamente (já tiramos o
      // scroll-behavior:smooth do CSS).
      anchors: true,
    });

    // Expõe a instância pro CustomScrollbar coordenar drag
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return null;
}
