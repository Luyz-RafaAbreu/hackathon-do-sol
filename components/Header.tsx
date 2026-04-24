"use client";
import Image from "next/image";
import { useEffect, useLayoutEffect, useState } from "react";

const links = [
  { href: "#sobre", label: "Sobre" },
  { href: "#informacoes", label: "Informações" },
  { href: "#cronograma", label: "Cronograma" },
  { href: "#materiais", label: "Materiais" },
  { href: "#faq", label: "FAQ" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // scroll spy — destaca a seção atualmente em foco
  useEffect(() => {
    const sections = links
      .map((l) => {
        const el = document.querySelector(l.href) as HTMLElement | null;
        return el ? { href: l.href, el } : null;
      })
      .filter(Boolean) as { href: string; el: HTMLElement }[];

    if (!sections.length) return;

    const onScroll = () => {
      const y = window.scrollY + 200;
      let current = "";
      for (const s of sections) {
        if (s.el.offsetTop <= y) current = s.href;
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // bloqueia scroll quando menu mobile está aberto
  // aplica em html E body — alguns browsers não propagam um pro outro
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    if (open) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } else {
      html.style.overflow = "";
      body.style.overflow = "";
    }
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* camada de fundo + blur — fade-in/out via opacidade (suave) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-sol-bgDeep/75 backdrop-blur-xl shadow-[0_0.5rem_2rem_-0.75rem_rgba(0,0,0,0.6)] transition-opacity ease-out duration-500 ${
          scrolled || open ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* linha gradiente na base — some quando o menu está aberto (junção visual) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sol-orange/50 to-transparent transition-opacity ease-out duration-500 ${
          scrolled && !open ? "opacity-100" : "opacity-0"
        }`}
      />

      <nav className="relative max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 h-16 md:h-20">
        {/* Logo */}
        <a
          href="#"
          className="group relative flex items-center gap-3 font-display font-bold text-base md:text-lg"
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden transition-transform duration-500 group-hover:scale-105">
            {/* glow atrás do logo */}
            <span className="absolute -inset-1 rounded-full bg-sol-orange/40 blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <Image
              src="/imagens/logo.webp"
              alt="Hackathon do Sol"
              width={40}
              height={40}
              className="relative rounded-full w-full h-full object-cover"
              priority
            />
          </div>
          <span className="hidden sm:inline whitespace-nowrap">
            Hackathon{" "}
            <span className="bg-gradient-to-r from-sol-yellow to-sol-orange bg-clip-text text-transparent">
              do Sol
            </span>
          </span>
        </a>

        {/* Nav desktop */}
        <ul className="hidden md:flex items-center gap-1 text-sm">
          {links.map((l) => {
            const isActive = active === l.href;
            return (
              <li key={l.href}>
                <a
                  href={l.href}
                  className={`relative inline-flex items-center px-4 py-2 rounded-lg transition-colors duration-300 ${
                    isActive
                      ? "text-white"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {l.label}
                  <span
                    className={`absolute left-1/2 bottom-0 h-0.5 -translate-x-1/2 rounded-full bg-gradient-to-r from-sol-orange to-sol-pink transition-all duration-300 ${
                      isActive ? "w-5 opacity-100" : "w-0 opacity-0"
                    }`}
                  />
                </a>
              </li>
            );
          })}
        </ul>

        {/* Ações à direita */}
        <div className="flex items-center gap-2">
          <a
            href="#inscricao"
            className="hidden md:inline-flex btn-primary !px-5 !py-2 text-sm"
          >
            Inscreva-se
          </a>

          {/* Hamburger animado */}
          <button
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] hover:border-sol-orange/50 hover:bg-white/[0.08] transition"
            onClick={() => setOpen((o) => !o)}
          >
            <span
              className={`absolute w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${
                open ? "rotate-45" : "-translate-y-[0.375rem]"
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${
                open ? "opacity-0 scale-50" : "opacity-100"
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${
                open ? "-rotate-45" : "translate-y-[0.375rem]"
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Menu mobile — overlay fullscreen */}
      <div
        className={`md:hidden fixed inset-x-0 top-16 bottom-0 z-40 transition-opacity duration-500 ease-out ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* fundo semi-transparente com blur — combina com a estética do site */}
        <div className="absolute inset-0 bg-sol-bgDeep/75 backdrop-blur-2xl" />
        {/* gradientes decorativos pra textura */}
        <div className="absolute inset-0 bg-gradient-to-b from-sol-purple/15 via-transparent to-sol-pink/5" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[80%] h-40 bg-sol-orange/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -right-20 w-60 h-60 bg-sol-pink/10 blur-3xl pointer-events-none" />

        {/* conteúdo */}
        <div className="relative h-full flex flex-col overflow-y-auto">
          <nav aria-label="Menu de navegação" className="flex-1 px-6 pt-8">
            <ul className="flex flex-col gap-1">
              {links.map((l, idx) => {
                const isActive = active === l.href;
                return (
                  <li
                    key={l.href}
                    className={`transition-all duration-500 ${
                      open
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    }`}
                    style={{
                      transitionDelay: open ? `${80 + idx * 50}ms` : "0ms",
                    }}
                  >
                    <a
                      onClick={() => setOpen(false)}
                      href={l.href}
                      className={`group flex items-center justify-between py-4 px-2 border-b border-white/5 transition ${
                        isActive
                          ? "text-white"
                          : "text-white/75 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-4">
                        <span
                          className={`font-display font-semibold text-xs tabular-nums transition ${
                            isActive ? "text-sol-orange" : "text-white/30"
                          }`}
                        >
                          0{idx + 1}
                        </span>
                        <span className="font-display font-semibold text-xl">
                          {l.label}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition ${
                          isActive
                            ? "bg-sol-orange/15 text-sol-orange"
                            : "text-white/40 group-hover:text-sol-orange"
                        }`}
                      >
                        <svg
                          className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* rodapé fixo: CTA + contato */}
          <div
            className={`px-6 pb-8 pt-6 border-t border-white/10 space-y-4 transition-all duration-500 ${
              open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionDelay: open ? `${80 + links.length * 50 + 50}ms` : "0ms",
            }}
          >
            <a
              onClick={() => setOpen(false)}
              href="#inscricao"
              className="btn-primary w-full"
            >
              <span className="relative z-10">Inscreva-se agora</span>
              <span className="relative z-10">→</span>
            </a>

            <div className="flex items-center justify-center gap-4 pt-2">
              <a
                href="https://instagram.com/hackathondosol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-sol-orange transition text-xs tracking-[0.2em] uppercase font-semibold"
              >
                @hackathondosol
              </a>
              <span className="w-px h-3 bg-white/20" />
              <a
                href="mailto:hackathondosol@gmail.com"
                className="text-white/60 hover:text-sol-orange transition text-xs font-medium"
              >
                Contato
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
