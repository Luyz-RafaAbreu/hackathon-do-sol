"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

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

  // bloqueia scroll do body quando menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* camada de fundo + blur — fade-in/out via opacidade (suave) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-sol-bgDeep/75 backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] transition-opacity ease-out duration-700 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* linha gradiente na base */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sol-orange/50 to-transparent transition-opacity ease-out duration-700 ${
          scrolled ? "opacity-100" : "opacity-0"
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
              className="relative rounded-full"
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
                open ? "rotate-45" : "-translate-y-[6px]"
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${
                open ? "opacity-0 scale-50" : "opacity-100"
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${
                open ? "-rotate-45" : "translate-y-[6px]"
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out ${
          open ? "max-h-[calc(100vh-4rem)] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-sol-bgDeep/95 backdrop-blur-xl border-t border-white/10">
          <ul className="flex flex-col p-6 gap-1">
            {links.map((l) => {
              const isActive = active === l.href;
              return (
                <li key={l.href}>
                  <a
                    onClick={() => setOpen(false)}
                    href={l.href}
                    className={`flex items-center justify-between py-3 px-4 rounded-xl transition ${
                      isActive
                        ? "bg-white/[0.06] text-white"
                        : "text-white/75 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>{l.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sol-orange" />
                    )}
                  </a>
                </li>
              );
            })}
            <a
              onClick={() => setOpen(false)}
              href="#inscricao"
              className="btn-primary w-full mt-3"
            >
              Inscreva-se
            </a>
          </ul>
        </div>
      </div>
    </header>
  );
}
