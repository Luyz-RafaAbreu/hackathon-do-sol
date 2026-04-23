"use client";
import { useState } from "react";
import Reveal from "./Reveal";

const faqs = [
  {
    q: "Quem pode participar?",
    a: "Qualquer pessoa maior de 16 anos interessada em tecnologia, inovação, design ou empreendedorismo. Estudantes e profissionais de todas as áreas são bem-vindos.",
  },
  {
    q: "Preciso ter equipe formada para me inscrever?",
    a: "Não. Você pode se inscrever individualmente e formar equipe durante o evento. Haverá um momento dedicado à formação de times no primeiro dia.",
  },
  {
    q: "O evento é presencial ou online?",
    a: "O Hackathon do Sol é 100% presencial, realizado na Praiamar Arena, com estrutura completa para os três dias.",
  },
  {
    q: "Como funciona a inscrição?",
    a: "Basta preencher o formulário nesta página. Após análise, você receberá um e-mail de confirmação com as próximas etapas.",
  },
  {
    q: "Onde acontecerá o evento?",
    a: "Na Praiamar Arena, em Natal/RN. O endereço completo e informações de acesso serão enviados aos participantes confirmados.",
  },
  {
    q: "O que preciso levar?",
    a: "Notebook, carregador, documento com foto e muita disposição. Consulte o guia do participante para a lista completa.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">FAQ</span>
          <h2 className="section-title">Perguntas frequentes</h2>
          <p className="section-subtitle">
            Ainda com dúvidas? Entre em contato pelo e-mail no rodapé ou pelo
            WhatsApp.
          </p>
        </div>
      </Reveal>

      <div className="space-y-3 max-w-3xl">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 60}>
              <div
                className={`rounded-2xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden transition-all duration-500 ${
                  isOpen
                    ? "border-sol-orange/60 bg-white/[0.05] shadow-[0_10px_40px_-20px_rgba(255,140,0,0.6)]"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 text-left p-5"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-display font-semibold text-base md:text-lg">
                    {f.q}
                  </span>
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xl transition-all duration-500 ${
                      isOpen
                        ? "bg-sol-orange text-black rotate-45"
                        : "bg-white/10 text-sol-orange"
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-500 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 text-white/75 text-sm leading-relaxed">
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
