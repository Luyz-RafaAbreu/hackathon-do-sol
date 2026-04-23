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
      className="relative min-h-[100svh] flex items-center justify-center pt-20 pb-4 md:pb-6 px-6 overflow-hidden noise"
    >
      <BackgroundFx />

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="text-center mb-2 md:mb-3 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur px-4 py-1 text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sol-orange" />
            </span>
            Inscrições abertas — vagas limitadas
          </span>
        </div>

        <div className="relative grid md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-4">
          <div className="flex md:justify-end animate-fade-up" style={{ animationDelay: "120ms" }}>
            <DateTag />
          </div>

          <div ref={logoWrapRef} className="flex justify-center transition-transform duration-300 ease-out">
            <LogoWithRings />
          </div>

          <div className="flex md:justify-start animate-fade-up" style={{ animationDelay: "240ms" }}>
            <LocalTag />
          </div>
        </div>

        <h1 className="sr-only">
          Hackathon do Sol — 26 a 28 de junho — Praiamar Arena
        </h1>

        <div className="mt-2 md:mt-3 text-center animate-fade-up" style={{ animationDelay: "360ms" }}>
          <p className="text-sm md:text-base text-white/85 max-w-2xl mx-auto leading-snug">
            Três dias de <span className="text-gradient-animated font-semibold">inovação, código e colaboração</span>. Bora codar sob o sol?
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
    <div className="relative w-[min(240px,36vh)] h-[min(240px,36vh)] sm:w-[min(280px,38vh)] sm:h-[min(280px,38vh)] md:w-[min(320px,38vh)] md:h-[min(320px,38vh)] lg:w-[min(380px,40vh)] lg:h-[min(380px,40vh)]">
      {/* conic gradient rotating ring */}
      <div className="absolute inset-0 rounded-full glow-ring opacity-60 animate-spin-slow" aria-hidden />

      {/* secondary dashed ring rotating reverse */}
      <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/20 animate-spin-reverse" aria-hidden />

      {/* the logo, clipped to circle to lose the square background corners */}
      <div className="absolute inset-6 rounded-full overflow-hidden shadow-glowStrong bg-sol-bgDeep">
        <Image
          src="/imagens/logo.webp"
          alt="Hackathon do Sol"
          width={480}
          height={480}
          priority
          className="w-full h-full object-cover"
        />
      </div>

      {/* orbiting satellites */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit">
            <div className="w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-sol-yellow shadow-glow" />
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 w-0 h-0" style={{ animationDelay: "-7s" }}>
          <div className="animate-orbit" style={{ animationDuration: "26s" }}>
            <div className="w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sol-pink/90 shadow-[0_0_20px_rgba(232,121,249,0.8)]" />
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div className="animate-orbit" style={{ animationDuration: "34s", animationDirection: "reverse" }}>
            <div className="w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-sol-teal shadow-[0_0_16px_rgba(20,184,166,0.8)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DateTag() {
  return (
    <div className="relative group animate-float-slow">
      <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-sol-orange/40 via-sol-teal/20 to-transparent blur-xl opacity-60 group-hover:opacity-100 transition" />
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-sol-teal/80 transform-gpu transition-transform duration-500 group-hover:-rotate-1 group-hover:scale-105">
        <div className="bg-white px-5 md:px-7 py-2.5 md:py-3 text-center">
          <div className="font-display font-extrabold text-2xl md:text-4xl text-sol-purple leading-none tracking-tight">
            26 A 28
          </div>
        </div>
        <div className="h-2 bg-[repeating-linear-gradient(135deg,#14b8a6_0,#14b8a6_10px,transparent_10px,transparent_20px)]" />
        <div className="bg-sol-orange px-5 md:px-7 py-1.5 md:py-2 text-center">
          <div className="font-display font-bold text-xs md:text-sm text-sol-purple tracking-[0.25em]">
            DE JUNHO
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalTag() {
  return (
    <div className="relative group animate-float-delayed">
      <div className="text-sol-orange font-display font-bold text-[10px] md:text-xs tracking-[0.3em] mb-1.5 text-center">
        LOCAL
      </div>
      <div className="absolute -inset-2 top-6 rounded-2xl bg-gradient-to-br from-sol-yellow/40 via-sol-pink/20 to-transparent blur-xl opacity-60 group-hover:opacity-100 transition" />
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-sol-teal/80 transform-gpu transition-transform duration-500 group-hover:rotate-1 group-hover:scale-105">
        <div className="bg-white px-5 md:px-7 py-2.5 md:py-3 text-center">
          <div className="font-display font-extrabold text-base md:text-xl text-sol-purple leading-none tracking-tight whitespace-nowrap">
            PRAIAMAR ARENA
          </div>
        </div>
        <div className="h-2 bg-[repeating-linear-gradient(135deg,#ffc830_0,#ffc830_10px,transparent_10px,transparent_20px)]" />
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

      {/* geometric anchors — só 2 grandes, o canvas cuida do resto */}
      <div className="hidden md:block absolute bottom-28 left-[16%] w-6 h-6 rotate-45 border-2 border-sol-teal/60" aria-hidden />
      <div className="hidden md:block absolute bottom-20 right-[14%] w-8 h-8 rotate-45 border-2 border-sol-purpleLight/60 animate-float-slow" aria-hidden />
    </>
  );
}
