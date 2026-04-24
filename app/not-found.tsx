import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ParticlesCanvas from "@/components/ParticlesCanvas";
import NotFoundHero from "@/components/NotFoundHero";

export const metadata: Metadata = {
  title: "Página não encontrada | Hackathon do Sol",
  description:
    "Essa página se perdeu no pôr do sol. Volte ao início e saiba mais sobre o Hackathon do Sol — 26 a 28 de junho em Natal/RN.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative min-h-[100svh] overflow-hidden flex flex-col bg-sol-bgDeep">
      <ParticlesCanvas />

      {/* fundo decorativo — mesmo tratamento do Hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 w-[31.25rem] h-[31.25rem] rounded-full bg-sol-purpleLight/25 blur-3xl animate-pulse-slow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-20 w-[37.5rem] h-[37.5rem] rounded-full bg-sol-pink/20 blur-3xl animate-pulse-slow"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-pattern opacity-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-fade" />

      {/* header compacto */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10 h-16 md:h-20 flex items-center">
        <Link
          href="/"
          className="group flex items-center gap-3 font-display font-bold text-base md:text-lg"
          aria-label="Voltar ao início do Hackathon do Sol"
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden transition-transform duration-500 group-hover:scale-105">
            <span className="absolute -inset-1 rounded-full bg-sol-orange/40 blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <Image
              src="/imagens/logo.webp"
              alt=""
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
        </Link>
      </header>

      {/* conteúdo principal — delegado ao client component com interação */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-4 sm:py-6 md:py-8 lg:py-10">
        <NotFoundHero />
      </div>
    </main>
  );
}
