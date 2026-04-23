"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import Countdown from "./Countdown";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const logoWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = heroRef.current;
    const logo = logoWrapRef.current;
    if (!el || !logo) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      logo.style.transform = `translate3d(${x * 18}px, ${y * 18}px, 0)`;
    };
    const onLeave = () => {
      logo.style.transform = "translate3d(0,0,0)";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100svh] flex items-center justify-center pt-20 md:pt-24 pb-4 md:pb-6 px-6 overflow-hidden"
    >
      <BackgroundFx />

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="text-center mb-2 md:mb-3 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur px-4 py-1 text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sol-orange" />
            </span>
            <span>Inscrições abertas</span>
            <span className="hidden sm:inline"> — 160 vagas</span>
          </span>
        </div>

        <div className="relative grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div
            className="flex justify-end md:justify-end animate-fade-up order-2 md:order-none"
            style={{ animationDelay: "120ms" }}
          >
            <DateTag />
          </div>

          <div
            ref={logoWrapRef}
            className="col-span-2 md:col-span-1 order-1 md:order-none flex justify-center transition-transform duration-300 ease-out"
          >
            <LogoWithRings />
          </div>

          <div
            className="flex justify-start md:justify-start animate-fade-up order-3 md:order-none"
            style={{ animationDelay: "240ms" }}
          >
            <LocalTag />
          </div>
        </div>

        <h1 className="sr-only">
          Hackathon do Sol — 26 a 28 de junho — Praiamar Arena
        </h1>

        <div className="mt-2 md:mt-3 text-center animate-fade-up" style={{ animationDelay: "360ms" }}>
          <p className="text-sm md:text-base text-white/85 max-w-2xl mx-auto leading-snug">
            Três dias de <span className="text-gradient-animated font-semibold">inovação, código e colaboração</span> — do nascer ao pôr do sol.
          </p>
        </div>

        <div className="mt-3 md:mt-4 animate-fade-up" style={{ animationDelay: "480ms" }}>
          <Countdown />
        </div>

        <div
          className="mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 animate-fade-up"
          style={{ animationDelay: "600ms" }}
        >
          <a href="#inscricao" className="btn-primary text-sm md:text-base">
            <span className="relative z-10">Inscreva-se agora</span>
            <span className="relative z-10 transition-transform group-hover:translate-x-1">→</span>
          </a>
          <a href="#sobre" className="btn-secondary text-sm md:text-base">
            Saiba mais
          </a>
        </div>
      </div>
    </section>
  );
}

function LogoWithRings() {
  return (
    <div className="relative w-[min(240px,36vh)] h-[min(240px,36vh)] sm:w-[min(280px,38vh)] sm:h-[min(280px,38vh)] md:w-[min(320px,38vh)] md:h-[min(320px,38vh)] lg:w-[min(380px,40vh)] lg:h-[min(380px,40vh)] [--orbit-r:calc(min(240px,36vh)/2)] sm:[--orbit-r:calc(min(280px,38vh)/2)] md:[--orbit-r:calc(min(320px,38vh)/2)] lg:[--orbit-r:calc(min(380px,40vh)/2)]">
      {/* conic gradient rotating ring */}
      <div className="absolute inset-0 rounded-full glow-ring opacity-60 animate-spin-slow" aria-hidden />

      {/* secondary dashed ring rotating reverse */}
      <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/20 animate-spin-reverse" aria-hidden />

      {/* the logo, clipped to circle to lose the square background corners */}
      <div className="absolute inset-6 rounded-full overflow-hidden shadow-glowStrong bg-sol-bgDeep">
        <Image
          src="/imagens/logo-hd.webp"
          alt="Hackathon do Sol"
          width={1200}
          height={1200}
          priority
          quality={95}
          sizes="(min-width: 1024px) 380px, (min-width: 768px) 320px, 280px"
          className="w-full h-full object-cover"
        />
      </div>

      {/* orbiting satellites — formas pequenas em outline */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Quadrado (amarelo) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit" style={{ animationDuration: "24s" }}>
            <div className="w-2 h-2 -translate-x-1/2 -translate-y-1/2 border border-sol-yellow/50" />
          </div>
        </div>

        {/* Círculo (rosa) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit" style={{ animationDuration: "28s", animationDelay: "-5s" }}>
            <div className="w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sol-pink/50" />
          </div>
        </div>

        {/* Triângulo (teal) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit" style={{ animationDuration: "32s", animationDelay: "-12s" }}>
            <svg
              className="w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 text-sol-teal/60"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            >
              <polygon points="5,1 9,9 1,9" />
            </svg>
          </div>
        </div>

        {/* X (laranja) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div
            className="animate-orbit"
            style={{
              animationDuration: "30s",
              animationDirection: "reverse",
              animationDelay: "-8s",
            }}
          >
            <svg
              className="w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 text-sol-orange/55"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
            </svg>
          </div>
        </div>

        {/* Quadrado pequeno (roxo claro) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div
            className="animate-orbit"
            style={{
              animationDuration: "36s",
              animationDirection: "reverse",
              animationDelay: "-18s",
            }}
          >
            <div className="w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 border border-sol-purpleLight/55" />
          </div>
        </div>

        {/* Círculo pequeno (amarelo) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit" style={{ animationDuration: "22s", animationDelay: "-15s" }}>
            <div className="w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sol-yellow/45" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TagLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <span className="h-px w-4 bg-gradient-to-r from-transparent to-sol-orange/60" />
      <span className="font-display font-semibold text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-white/60">
        {text}
      </span>
      <span className="h-px w-4 bg-gradient-to-l from-transparent to-sol-orange/60" />
    </div>
  );
}

function DateTag() {
  return (
    <div className="relative group animate-float-slow">
      <TagLabel text="Data" />
      <div className="absolute -inset-2 top-6 rounded-2xl bg-gradient-to-br from-sol-orange/40 via-emerald-500/20 to-transparent blur-xl opacity-60 group-hover:opacity-100 transition" />

      <div className="relative transform-gpu transition-transform duration-500 group-hover:-rotate-1 group-hover:scale-105">
<div className="rounded-2xl overflow-hidden shadow-[0_18px_40px_-12px_rgba(0,0,0,0.5)]">
          <div className="bg-white px-3 md:px-8 py-2 md:py-3.5 text-center">
            <div className="font-display font-extrabold text-xl md:text-4xl text-sol-purple leading-none tracking-tight">
              26 A 28
            </div>
          </div>
          <div className="h-2.5 md:h-4 bg-[repeating-linear-gradient(135deg,#10b981_0,#10b981_8px,#064e3b_8px,#064e3b_16px)]" />
          <div className="bg-sol-orange px-3 md:px-8 py-1.5 md:py-2.5 text-center">
            <div className="font-display font-extrabold text-[11px] md:text-base text-sol-purple tracking-[0.2em] md:tracking-[0.25em]">
              DE JUNHO
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalTag() {
  return (
    <div className="relative group animate-float-delayed">
      <TagLabel text="Local" />
      <div className="absolute -inset-2 top-6 rounded-2xl bg-gradient-to-br from-sol-yellow/40 via-sol-pink/20 to-transparent blur-xl opacity-60 group-hover:opacity-100 transition" />

      <div className="relative transform-gpu transition-transform duration-500 group-hover:rotate-1 group-hover:scale-105">
<div className="rounded-2xl overflow-hidden shadow-[0_18px_40px_-12px_rgba(0,0,0,0.5)]">
          <div className="bg-white px-3 md:px-8 py-2 md:py-3.5 text-center">
            <div className="font-display font-extrabold text-xs md:text-xl text-sol-purple leading-none tracking-tight whitespace-nowrap">
              PRAIAMAR ARENA
            </div>
          </div>
          <div className="h-2.5 md:h-4 bg-[repeating-linear-gradient(135deg,#ffc830_0,#ffc830_8px,#92400e_8px,#92400e_16px)]" />
        </div>
      </div>
    </div>
  );
}

function BackgroundFx() {
  return (
    <>
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute inset-0 bg-grid-fade" />

      {/* radial blobs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-sol-purpleLight/25 blur-3xl animate-pulse-slow" aria-hidden />
      <div className="absolute -bottom-20 -right-20 w-[600px] h-[600px] rounded-full bg-sol-pink/20 blur-3xl animate-pulse-slow" aria-hidden />
      <div className="absolute top-1/3 right-10 w-64 h-64 rounded-full bg-sol-orange/15 blur-3xl animate-float-slow" aria-hidden />
      <div className="absolute bottom-1/4 left-10 w-72 h-72 rounded-full bg-sol-teal/15 blur-3xl animate-float-delayed" aria-hidden />

    </>
  );
}
