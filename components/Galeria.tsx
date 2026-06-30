"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ArrowUpRight,
  ZoomIn,
  X,
} from "lucide-react";
import Reveal from "./Reveal";

// URL pública da pasta do Google Drive com TODAS as fotos do evento.
const DRIVE_URL = "https://drive.google.com/drive/folders/13g8g-Z2r-K4xTvqz1LFtMxTMOMsFM0nj";

type Foto = {
  id: number;
  src: string;
  w: number; // dimensões reais (pós-otimização) — usadas no lightbox
  h: number;
  legenda: string;
};

// Fotos otimizadas para web em public/imagens/galeria/ (originais ~20 MB cada
// foram redimensionadas p/ 1920px / qualidade 78). Para trocar/adicionar:
// jogue o arquivo na pasta e atualize src + w/h + legenda aqui.
const fotos: Foto[] = [
  { id: 1, src: "/imagens/galeria/foto-1.jpg", w: 1920, h: 1453, legenda: "Chegada e credenciamento" },
  { id: 2, src: "/imagens/galeria/foto-2.jpg", w: 1280, h: 1920, legenda: "Boas-vindas no Hackathon do Sol" },
  { id: 3, src: "/imagens/galeria/foto-3.jpg", w: 1920, h: 1299, legenda: "40 equipes na maratona" },
  { id: 4, src: "/imagens/galeria/foto-4.jpg", w: 1280, h: 1920, legenda: "Mão na massa, em equipe" },
  { id: 5, src: "/imagens/galeria/foto-5.jpg", w: 1503, h: 1920, legenda: "Palestras e mentorias" },
  { id: 6, src: "/imagens/galeria/foto-6.jpg", w: 1920, h: 1796, legenda: "Pitch das soluções" },
];

const AUTOPLAY_MS = 5000;

export default function Galeria() {
  const total = fotos.length;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(1);
  const [paused, setPaused] = useState(false);
  // índice da foto aberta no lightbox (null = fechado)
  const [lightbox, setLightbox] = useState<number | null>(null);

  // largura de um "passo" = card + gap. Medido do DOM pra ser responsivo
  // (quantos cards aparecem por vez muda por breakpoint).
  const stepOf = (el: HTMLDivElement) => {
    const card = el.querySelector<HTMLElement>("[data-card]");
    if (!card) return el.clientWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return card.offsetWidth + gap;
  };

  const scrollByCards = useCallback((dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * stepOf(el), behavior: "smooth" });
  }, []);

  const maxScrollOf = (el: HTMLDivElement) => el.scrollWidth - el.clientWidth;

  const goTo = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const max = maxScrollOf(el);
      // o último "dot" rola exatamente até o fim, garantindo a última foto
      // 100% visível (o snap-end no último card alinha ela pela direita)
      const left = i >= pages - 1 ? max : Math.min(i * stepOf(el), max);
      el.scrollTo({ left, behavior: "smooth" });
    },
    [pages]
  );

  // nº de posições ancoráveis (= nº de dots). Depende de quantos cards cabem
  // por vez, o que muda por breakpoint — então medimos do DOM e recalculamos
  // no resize. Com 6 fotos e 3 visíveis, dá 4 posições, não 6.
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = stepOf(el);
    const max = maxScrollOf(el);
    const p = step > 0 ? Math.round(max / step) + 1 : 1;
    setPages(Math.max(1, Math.min(total, p)));
  }, [total]);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    const ro = new ResizeObserver(() => measure());
    if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // dot ativo = posição mais próxima da borda esquerda (ou a última no fim)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = maxScrollOf(el);
        let i = Math.round(el.scrollLeft / stepOf(el));
        if (el.scrollLeft >= max - 2) i = pages - 1; // chegou ao fim
        setActive(Math.max(0, Math.min(pages - 1, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pages]);

  // autoplay — pausa no hover/foco/toque, com o lightbox aberto, e respeita
  // prefers-reduced-motion. Ao chegar no fim, volta pro começo.
  useEffect(() => {
    if (paused || lightbox !== null) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: stepOf(el), behavior: "smooth" });
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, lightbox]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByCards(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByCards(1);
    }
  };

  // ── Lightbox: teclado (Esc/setas) + trava o scroll do fundo ──
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const stepLightbox = useCallback(
    (dir: number) =>
      setLightbox((v) => (v === null ? v : (v + dir + total) % total)),
    [total]
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, [lightbox, closeLightbox, stepLightbox]);

  return (
    <section id="galeria" className="section !pt-24 !pb-12">
      {/* coluna única — título, botões, carrossel e dots compartilham a mesma
          largura/alinhamento (bordas batem com o título) */}
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="mb-5">
            <span className="eyebrow">Galeria</span>
            <h2 className="section-title">Como foi o Hackathon do Sol</h2>
            <p className="section-subtitle">
              Um recorte dos três dias de maratona. Clique em qualquer foto para
              ampliar — e o álbum completo está no Google Drive.
            </p>
          </div>
        </Reveal>

        {/* Link do Drive — ACIMA do carrossel, com destaque */}
        <Reveal delay={120}>
          <div className="mb-6 flex justify-center">
            <a
              href={DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 rounded-full border-[0.125rem] border-sol-orange/50 bg-sol-orange/10 px-6 py-3 font-semibold text-sol-orange transition-all hover:border-sol-orange hover:bg-sol-orange/15 hover:gap-4"
            >
              <FolderOpen className="w-5 h-5" strokeWidth={2.2} />
              <span>Ver todas as fotos no Google Drive</span>
              <ArrowUpRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2.5}
              />
            </a>
          </div>
        </Reveal>

        {/* Carrossel — filmstrip horizontal */}
        <Reveal delay={200}>
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {/* trilho com scroll-snap (swipe nativo no mobile) */}
            <div
              ref={scrollerRef}
              tabIndex={0}
              role="region"
              aria-roledescription="carrossel"
              aria-label="Fotos do Hackathon do Sol"
              onKeyDown={onKeyDown}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              className="no-scrollbar flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-sol-orange/60"
            >
              {fotos.map((foto, i) => (
                <figure
                  key={foto.id}
                  data-card
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} de ${total}: ${foto.legenda}`}
                  className={`group relative shrink-0 basis-[82%] sm:basis-[47%] lg:basis-[31.5%] h-[clamp(11rem,32vh,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${
                    i === total - 1 ? "snap-end" : "snap-start"
                  }`}
                >
                  <Image
                    src={foto.src}
                    alt={foto.legenda}
                    fill
                    sizes="(max-width: 640px) 82vw, (max-width: 1024px) 47vw, 31vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    priority={i === 0}
                  />

                  {/* clique amplia (lightbox) — overlay transparente cobrindo o card */}
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    aria-label={`Ampliar foto: ${foto.legenda}`}
                    className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sol-orange"
                  >
                    <span className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/45 backdrop-blur text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <ZoomIn className="w-4 h-4" strokeWidth={2.2} />
                    </span>
                  </button>
                </figure>
              ))}
            </div>

            {/* seta anterior */}
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              aria-label="Fotos anteriores"
              className="absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-sol-bgDeep/80 backdrop-blur border border-white/15 text-white transition-all hover:bg-sol-bgDeep hover:border-sol-orange/60"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.4} />
            </button>

            {/* seta próxima */}
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              aria-label="Próximas fotos"
              className="absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-sol-bgDeep/80 backdrop-blur border border-white/15 text-white transition-all hover:bg-sol-bgDeep hover:border-sol-orange/60"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2.4} />
            </button>
          </div>
        </Reveal>

        {/* dots */}
        <div className="mt-5 flex items-center justify-center gap-2.5">
          {Array.from({ length: pages }).map((_, i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para a posição ${i + 1} de ${pages}`}
                aria-current={isActive}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-7 bg-gradient-to-r from-sol-orange to-sol-pink"
                    : "w-2.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada: ${fotos[lightbox].legenda}`}
          onClick={closeLightbox}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
        >
          {/* fechar */}
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white transition hover:bg-white/20"
          >
            <X className="w-5 h-5" strokeWidth={2.4} />
          </button>

          {/* anterior */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              stepLightbox(-1);
            }}
            aria-label="Foto anterior"
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.4} />
          </button>

          {/* próxima */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              stepLightbox(1);
            }}
            aria-label="Próxima foto"
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="w-6 h-6" strokeWidth={2.4} />
          </button>

          {/* imagem + legenda (clique aqui NÃO fecha) */}
          <figure
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center gap-3 max-w-[92vw]"
          >
            <Image
              src={fotos[lightbox].src}
              alt={fotos[lightbox].legenda}
              width={fotos[lightbox].w}
              height={fotos[lightbox].h}
              sizes="92vw"
              className="h-auto w-auto max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
              priority
            />
            <figcaption className="text-center font-display font-semibold text-white/70 text-sm tabular-nums">
              {lightbox + 1} / {total}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
