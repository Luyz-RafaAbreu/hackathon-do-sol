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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled
          ? "bg-sol-bgDeep/85 backdrop-blur-lg border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 h-16">
        <a href="#" className="flex items-center gap-2 font-display font-bold text-lg">
          <Image
            src="/imagens/logo.webp"
            alt="Hackathon do Sol"
            width={36}
            height={36}
            className="rounded-full shadow-glow"
            priority
          />
          <span>
            Hackathon <span className="text-sol-orange">do Sol</span>
          </span>
        </a>

        <ul className="hidden md:flex items-center gap-8 text-sm text-white/80">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="hover:text-sol-orange transition">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#inscricao" className="hidden md:inline-flex btn-primary !px-5 !py-2 text-sm">
          Inscreva-se
        </a>

        <button
          aria-label="Abrir menu"
          className="md:hidden p-2"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="w-6 h-0.5 bg-white mb-1.5" />
          <div className="w-6 h-0.5 bg-white mb-1.5" />
          <div className="w-6 h-0.5 bg-white" />
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-sol-bgDeep/95 backdrop-blur">
          <ul className="flex flex-col p-6 gap-4">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  onClick={() => setOpen(false)}
                  href={l.href}
                  className="block py-2 text-white/80 hover:text-sol-orange"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <a
              onClick={() => setOpen(false)}
              href="#inscricao"
              className="btn-primary w-full"
            >
              Inscreva-se
            </a>
          </ul>
        </div>
      )}
    </header>
  );
}
