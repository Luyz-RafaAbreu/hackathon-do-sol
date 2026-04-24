"use client";
import { useState } from "react";
import Reveal from "./Reveal";

const faqs = [
  {
    q: "Quem pode participar?",
    a: "Profissionais, estudantes e entusiastas de tecnologia interessados em inovação, desenvolvimento, design ou empreendedorismo. A idade mínima e demais critérios serão detalhados no edital oficial.",
  },
  {
    q: "Preciso ter equipe formada para me inscrever?",
    a: "Não. A inscrição pode ser feita individualmente — a organização apoia a formação de equipes no início do evento. As equipes são compostas por 4 pessoas.",
  },
  {
    q: "O evento é presencial ou online?",
    a: "100% presencial, realizado na Praiamar Arena, em Natal/RN, com estrutura completa para os três dias de atividades.",
  },
  {
    q: "Como funciona a inscrição?",
    a: "Basta preencher o formulário nesta página. A organização analisa as inscrições e envia a confirmação por e-mail, com as próximas etapas e orientações.",
  },
  {
    q: "Onde acontecerá o evento?",
    a: "Na Praiamar Arena — Av. Senador Salgado Filho, 1906, Lagoa Nova, Natal/RN (CEP 59075-000). Informações de acesso e logística serão enviadas aos participantes confirmados.",
  },
  {
    q: "O que preciso levar?",
    a: "Notebook, carregador, documento com foto e material pessoal para três dias. A lista completa estará no guia do participante, publicado antes do evento.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="section">
      <Reveal>
        <div className="mb-8">
          <span className="eyebrow">FAQ</span>
          <h2 className="section-title">Perguntas frequentes</h2>
          <p className="section-subtitle">
            Ainda com dúvidas? Entre em contato pelo e-mail no rodapé ou pelo
            Instagram.
          </p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="max-w-3xl mb-6 rounded-2xl border border-sol-yellow/40 bg-sol-yellow/5 backdrop-blur-sm px-5 py-4 text-sm text-white/80 leading-relaxed">
          <strong className="text-sol-yellow">⚠ Informações preliminares:</strong>{" "}
          as respostas abaixo são provisórias e podem ser ajustadas antes do
          evento. Apenas <strong>data (26–28 de junho)</strong> e{" "}
          <strong>local (Praiamar Arena, Natal/RN)</strong> estão confirmados.
        </div>
      </Reveal>

      <div className="space-y-3 max-w-3xl">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 60}>
              <div
                className={`group rounded-2xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden transition-all duration-500 ${
                  isOpen
                    ? "border-sol-orange/60 bg-white/[0.05] shadow-[0_0.625rem_2.5rem_-1.25rem_rgba(255,140,0,0.6)]"
                    : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 text-left p-5 md:px-6"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`font-display font-semibold text-base md:text-lg transition-colors ${
                      isOpen ? "text-white" : "text-white/90 group-hover:text-white"
                    }`}
                  >
                    {f.q}
                  </span>
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isOpen
                        ? "bg-sol-orange text-black rotate-45"
                        : "bg-white/10 text-sol-orange"
                    }`}
                    aria-hidden
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M7 1v12M1 7h12" />
                    </svg>
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-500 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 md:px-6 pb-5 text-white/75 text-sm md:text-[0.9375rem] leading-relaxed border-t border-white/[0.06] pt-4">
                      {f.a}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
