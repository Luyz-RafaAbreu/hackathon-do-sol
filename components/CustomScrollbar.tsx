"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Scrollbar custom em DOM — substitui a nativa.
 *
 * Por que existir: a scrollbar nativa é pintada pelo SO numa camada acima
 * de qualquer elemento HTML, então `z-index` não alcança. Sem essa
 * substituição, o cursor custom seria sempre cortado pela barra. Aqui
 * escondemos a nativa (globals.css) e renderizamos uma réplica em DOM,
 * onde z-index funciona normal — cursor passa por cima sem cortar.
 *
 * Roda do mouse continua funcionando direto no document (não interceptamos).
 * Drag do thumb e click no track pulam pra posição esperada. Mobile/touch
 * pula o componente — navegadores móveis já não desenham scrollbar persistente.
 */
export default function CustomScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    const update = () => {
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      const maxScroll = docH - winH;
      if (maxScroll <= 0) {
        setVisible(false);
        return;
      }
      setVisible(true);
      const trackH = track.clientHeight;
      // Tamanho do thumb proporcional ao quanto da página cabe na viewport,
      // com mínimo de 40px pra continuar agarrável em páginas muito longas.
      const thumbH = Math.max(40, (winH / docH) * trackH);
      const maxThumbY = trackH - thumbH;
      const y = (window.scrollY / maxScroll) * maxThumbY;
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${y}px)`;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    let dragStartY = 0;
    let dragStartScroll = 0;
    let dragging = false;

    const onThumbDown = (e: MouseEvent) => {
      e.preventDefault();
      dragging = true;
      dragStartY = e.clientY;
      dragStartScroll = window.scrollY;
      document.body.style.userSelect = "none";
      // Pausa o Lenis (smooth scroll) durante o drag — sem isso, ele
      // animaria suavemente cada update do drag e o thumb pareceria
      // travado, só seguindo o mouse ao soltar.
      (
        window as unknown as { __lenis?: { stop: () => void; start: () => void } }
      ).__lenis?.stop();
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      const maxScroll = docH - winH;
      const trackH = track.clientHeight;
      const thumbH = thumb.clientHeight;
      const maxThumbY = trackH - thumbH;
      if (maxThumbY <= 0) return;
      const dy = e.clientY - dragStartY;
      const next = dragStartScroll + (dy / maxThumbY) * maxScroll;
      document.documentElement.scrollTop = Math.max(
        0,
        Math.min(maxScroll, next)
      );
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      (
        window as unknown as { __lenis?: { stop: () => void; start: () => void } }
      ).__lenis?.start();
    };

    const onTrackClick = (e: MouseEvent) => {
      if (e.target === thumb) return;
      const rect = track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      const maxScroll = docH - winH;
      const trackH = track.clientHeight;
      const thumbH = thumb.clientHeight;
      const usable = trackH - thumbH;
      if (usable <= 0) return;
      const target = ((clickY - thumbH / 2) / usable) * maxScroll;
      window.scrollTo({
        top: Math.max(0, Math.min(maxScroll, target)),
        behavior: "smooth",
      });
    };

    thumb.addEventListener("mousedown", onThumbDown);
    track.addEventListener("click", onTrackClick);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      thumb.removeEventListener("mousedown", onThumbDown);
      track.removeEventListener("click", onTrackClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      ref={trackRef}
      aria-hidden
      className={`fixed top-0 right-0 bottom-0 w-2.5 z-[9000] transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ background: "#0f0624" }}
    >
      <div
        ref={thumbRef}
        data-cursor="hand"
        className="absolute left-0 right-0 rounded-[0.625rem]"
        style={{
          background: "linear-gradient(180deg, #7c3aed, #ff8c00)",
        }}
      />
    </div>
  );
}
