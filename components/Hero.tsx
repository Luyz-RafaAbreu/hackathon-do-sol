"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowRight, Lock } from "lucide-react";
import Countdown from "./Countdown";
import MagneticButton from "./MagneticButton";
import { BLUR } from "@/lib/blur-data";
import { EVENT } from "@/lib/event";

export default function Hero({
  inscriptionsOpen = true,
}: {
  inscriptionsOpen?: boolean;
}) {
  const heroRef = useRef<HTMLElement | null>(null);
  const logoWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = heroRef.current;
    const logo = logoWrapRef.current;
    if (!el || !logo) return;

    // Respeita preferência do SO — quem pediu menos animação não recebe parallax
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let pending = false;
    // Cache do rem — getComputedStyle a cada move é forced reflow caro.
    // Re-lemos só em resize, que é quando a escala fluida (clamp em html)
    // realmente muda.
    let remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

    const apply = () => {
      rafId = null;
      if (!pending) return;
      pending = false;
      const rect = el.getBoundingClientRect();
      const x = (lastX - rect.left) / rect.width - 0.5;
      const y = (lastY - rect.top) / rect.height - 0.5;
      // 1.125rem ≈ 18px em 1080p/720p, escala em 4K
      const d = 1.125 * remPx;
      logo.style.transform = `translate3d(${x * d}px, ${y * d}px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      pending = true;
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = false;
      logo.style.transform = "translate3d(0,0,0)";
    };
    const onResize = () => {
      remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
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
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur px-4 py-1 text-[0.625rem] md:text-xs uppercase tracking-[0.3em] text-white/80">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  inscriptionsOpen ? "bg-sol-orange animate-ping" : "bg-white/40"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  inscriptionsOpen ? "bg-sol-orange" : "bg-white/40"
                }`}
              />
            </span>
            {inscriptionsOpen ? (
              <>
                <span>Inscrições abertas</span>
                <span className="hidden sm:inline"> — {EVENT.SLOTS} vagas</span>
              </>
            ) : (
              <span>Inscrições encerradas</span>
            )}
          </span>
        </div>

        <div className="relative grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div
            ref={logoWrapRef}
            className="flex justify-center transition-transform duration-300 ease-out md:col-start-2 md:row-start-1"
          >
            <LogoWithRings />
          </div>

          {/* Wrapper mobile: flex centralizado. Desktop: vira transparente (contents) e cada tag vai para sua coluna */}
          <div className="flex flex-row items-end justify-center gap-3 md:contents">
            <div
              className="flex-shrink-0 animate-fade-up md:flex md:justify-end md:col-start-1 md:row-start-1"
              style={{ animationDelay: "120ms" }}
            >
              <DateTag />
            </div>

            <div
              className="flex-shrink-0 animate-fade-up md:flex md:justify-start md:col-start-3 md:row-start-1"
              style={{ animationDelay: "240ms" }}
            >
              <LocalTag />
            </div>
          </div>
        </div>

        <h1 className="sr-only">
          {EVENT.NAME} — {EVENT.DATE_RANGE_SHORT} — {EVENT.LOCATION_NAME}
        </h1>

        <div className="mt-2 md:mt-3 text-center animate-fade-up" style={{ animationDelay: "360ms" }}>
          <p className="text-sm md:text-base text-white/85 max-w-2xl mx-auto leading-snug">
            Três dias de <span className="text-gradient-animated font-semibold">inovação, código e colaboração</span> — do nascer ao pôr do sol.
          </p>
        </div>

        <div className="mt-3 md:mt-4 animate-fade-up" style={{ animationDelay: "480ms" }}>
          <Countdown />
        </div>

        {!inscriptionsOpen && (
          <div
            className="mt-5 md:mt-6 mx-auto max-w-2xl animate-fade-up"
            style={{ animationDelay: "540ms" }}
          >
            <div className="relative rounded-2xl border-[0.125rem] border-sol-orange/40 bg-sol-orange/[0.06] backdrop-blur-sm px-5 py-4 md:px-6 md:py-5 flex items-center gap-4 overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-transparent via-sol-orange to-transparent"
              />
              <div className="shrink-0 w-11 h-11 rounded-xl bg-sol-orange/15 border border-sol-orange/40 flex items-center justify-center">
                <Lock className="w-5 h-5 text-sol-orange" strokeWidth={2.2} />
              </div>
              <div className="text-left">
                <div className="font-display font-bold text-base md:text-lg leading-tight text-white">
                  Inscrições encerradas
                </div>
                <div className="text-xs md:text-sm text-white/70 leading-snug mt-0.5">
                  Acompanhe o @hackathondosol pra ser avisado da próxima edição.
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 animate-fade-up"
          style={{ animationDelay: "600ms" }}
        >
          {inscriptionsOpen ? (
            <MagneticButton>
              <a href="/inscricao" className="btn-primary group text-sm md:text-base">
                <span className="relative z-10">Inscreva-se agora</span>
                <ArrowRight
                  className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={2.5}
                />
              </a>
            </MagneticButton>
          ) : (
            <MagneticButton>
              <a
                href="https://instagram.com/hackathondosol"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-[0.125rem] border-sol-orange/50 bg-sol-orange/10 text-sol-orange font-semibold px-7 py-3 text-sm md:text-base hover:border-sol-orange hover:bg-sol-orange/15 transition"
              >
                {/* Lucide não tem Instagram (trademark) — SVG inline */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.247 2.242 1.308 3.608.058 1.266.069 1.646.069 4.85s-.011 3.584-.069 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.247-3.608 1.308-1.266.058-1.646.069-4.85.069s-3.584-.011-4.85-.069c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.247-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.247 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.141 0-3.51.012-4.747.068-.975.045-1.504.207-1.857.344-.467.181-.8.398-1.15.748-.35.35-.567.683-.748 1.15-.137.353-.299.882-.344 1.857C3.098 9.49 3.086 9.859 3.086 13s.012 3.51.068 4.747c.045.975.207 1.504.344 1.857.181.467.398.8.748 1.15.35.35.683.567 1.15.748.353.137.882.299 1.857.344 1.237.056 1.606.068 4.747.068s3.51-.012 4.747-.068c.975-.045 1.504-.207 1.857-.344.467-.181.8-.398 1.15-.748.35-.35.567-.683.748-1.15.137-.353.299-.882.344-1.857.056-1.237.068-1.606.068-4.747s-.012-3.51-.068-4.747c-.045-.975-.207-1.504-.344-1.857a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.299-1.857-.344C15.51 4.013 15.141 4.001 12 4.001zm0 3.136A4.863 4.863 0 1112 16.862 4.863 4.863 0 0112 7.137zm0 8.021a3.158 3.158 0 100-6.316 3.158 3.158 0 000 6.316zm6.188-8.224a1.137 1.137 0 11-2.274 0 1.137 1.137 0 012.274 0z" />
                </svg>
                <span>Siga pra próxima edição</span>
              </a>
            </MagneticButton>
          )}
          <MagneticButton>
            <a href="#sobre" className="btn-secondary text-sm md:text-base">
              Saiba mais
            </a>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

function LogoWithRings() {
  return (
    <div className="relative aspect-square w-[min(15rem,36vh)] h-[min(15rem,36vh)] sm:w-[min(17.5rem,38vh)] sm:h-[min(17.5rem,38vh)] md:w-[min(20rem,38vh)] md:h-[min(20rem,38vh)] lg:w-[min(23.75rem,40vh)] lg:h-[min(23.75rem,40vh)] [--orbit-r:calc(min(15rem,36vh)/2)] sm:[--orbit-r:calc(min(17.5rem,38vh)/2)] md:[--orbit-r:calc(min(20rem,38vh)/2)] lg:[--orbit-r:calc(min(23.75rem,40vh)/2)]">
      {/* conic gradient rotating ring */}
      <div className="absolute inset-0 rounded-full glow-ring opacity-60 animate-spin-slow" aria-hidden />

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
          placeholder="blur"
          blurDataURL={BLUR["logo-hd"]}
        />
      </div>

      {/* secondary dashed ring rotating reverse — renderizado APÓS o logo.
          Em inset-1 (4px) o anel fica perto da borda do container, ou seja,
          perto do raio de órbita dos satélites (que orbitam na borda exata).
          Logo em inset-6 fica bem dentro, espaço maior entre logo e anel. */}
      <div
        className="absolute inset-1 rounded-full border border-dashed border-white/35 animate-spin-reverse pointer-events-none"
        aria-hidden
      />

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
      <span className="font-display font-semibold text-[0.625rem] md:text-[0.6875rem] tracking-[0.32em] uppercase text-white/60">
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
<div className="rounded-2xl overflow-hidden shadow-[0_1.125rem_2.5rem_-0.75rem_rgba(0,0,0,0.5)]">
          <div className="bg-white px-3 md:px-8 py-2 md:py-3.5 text-center">
            <div className="font-display font-extrabold text-xl md:text-4xl text-sol-purple leading-none tracking-tight">
              {EVENT.DAYS_RANGE_UPPER}
            </div>
          </div>
          <div className="h-2.5 md:h-4 bg-[repeating-linear-gradient(135deg,#10b981_0,#10b981_0.5rem,#064e3b_0.5rem,#064e3b_1rem)]" />
          <div className="bg-sol-orange px-3 md:px-8 py-1.5 md:py-2.5 text-center">
            <div className="font-display font-extrabold text-[0.6875rem] md:text-base text-sol-purple tracking-[0.2em] md:tracking-[0.25em]">
              DE {EVENT.MONTH_UPPER}
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
<div className="rounded-2xl overflow-hidden shadow-[0_1.125rem_2.5rem_-0.75rem_rgba(0,0,0,0.5)]">
          <div className="bg-white px-3 md:px-8 py-2 md:py-3.5 text-center">
            <div className="font-display font-extrabold text-xs md:text-xl text-sol-purple leading-none tracking-tight whitespace-nowrap">
              {EVENT.LOCATION_NAME.toUpperCase()}
            </div>
          </div>
          <div className="h-2.5 md:h-4 bg-[repeating-linear-gradient(135deg,#ffc830_0,#ffc830_0.5rem,#92400e_0.5rem,#92400e_1rem)]" />
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
      <div className="absolute -top-32 -left-32 w-[31.25rem] h-[31.25rem] rounded-full bg-sol-purpleLight/25 blur-3xl animate-pulse-slow" aria-hidden />
      <div className="absolute -bottom-20 -right-20 w-[37.5rem] h-[37.5rem] rounded-full bg-sol-pink/20 blur-3xl animate-pulse-slow" aria-hidden />
      <div className="absolute top-1/3 right-10 w-64 h-64 rounded-full bg-sol-orange/15 blur-3xl animate-float-slow" aria-hidden />
      <div className="absolute bottom-1/4 left-10 w-72 h-72 rounded-full bg-sol-teal/15 blur-3xl animate-float-delayed" aria-hidden />

    </>
  );
}
