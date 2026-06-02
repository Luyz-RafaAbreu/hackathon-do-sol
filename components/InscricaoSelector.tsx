"use client";
// ============================================================================
// components/InscricaoSelector.tsx
// ----------------------------------------------------------------------------
// Tela inicial do /inscricao — escolha entre os 2 modos de inscrição:
//   1) Tenho equipe → fluxo atual (9 etapas, 4 integrantes)
//   2) Vou sozinho → fluxo curto (3 etapas, dados próprios) — organização
//      forma a equipe baseada em critérios do aditivo do Edital
//
// Decisão fica armazenada em localStorage pra sobreviver a refresh; pode
// ser trocada via botão "Mudar escolha" dentro de cada fluxo.
// ============================================================================
import { Users, User, ArrowRight } from "lucide-react";

export type InscricaoModo = "equipe" | "individual";

type Props = {
  onSelect: (modo: InscricaoModo) => void;
};

export default function InscricaoSelector({ onSelect }: Props) {
  return (
    <section
      id="inscricao"
      className="relative px-6 md:px-10 max-w-5xl mx-auto pb-20 md:pb-24"
    >
      <div className="text-center mb-10 md:mb-14">
        <span className="eyebrow">Como você quer se inscrever?</span>
        <h2 className="section-title">Escolha o modo de inscrição</h2>
        <p className="section-subtitle max-w-2xl mx-auto">
          Você pode se inscrever junto com sua equipe completa de 4 pessoas, ou
          se inscrever sozinho — a organização forma sua equipe com base em
          critérios do aditivo do Edital.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card 1 — Equipe completa */}
        <button
          type="button"
          onClick={() => onSelect("equipe")}
          className="group card text-left relative overflow-hidden h-full transition-all duration-500 hover:border-sol-orange/60 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-sol-orange/70"
        >
          <div className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow to-sol-orange" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br from-sol-yellow to-sol-orange opacity-15 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-25" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-xl bg-gradient-to-br from-sol-yellow to-sol-orange shadow-[0_0.5rem_1.25rem_-0.5rem_rgba(255,140,0,0.5)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
              <Users className="w-7 h-7 text-sol-bgDeep" strokeWidth={2.2} />
            </div>
            <h3 className="font-display font-semibold text-xl mb-2">
              Tenho equipe de 4 pessoas
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-5">
              Preencho os dados de todos os 4 integrantes, escolho a trilha,
              descrevo a proposta e a equipe inteira aceita os termos. Leva
              uns 20–30 minutos com os dados em mãos.
            </p>
            <ul className="space-y-1.5 text-sm text-white/60 mb-6">
              <li>• 4 integrantes nominais</li>
              <li>• Proposta inicial da equipe</li>
              <li>• Aceites individuais + coletivos</li>
            </ul>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-sol-orange group-hover:gap-3 transition-all">
              Selecionar este modo
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
        </button>

        {/* Card 2 — Inscrição individual */}
        <button
          type="button"
          onClick={() => onSelect("individual")}
          className="group card text-left relative overflow-hidden h-full transition-all duration-500 hover:border-sol-purpleLight/60 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-sol-purpleLight/70"
        >
          <div className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-purpleLight to-sol-teal" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br from-sol-purpleLight to-sol-teal opacity-15 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-25" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-xl bg-gradient-to-br from-sol-purpleLight to-sol-teal shadow-[0_0.5rem_1.25rem_-0.5rem_rgba(160,120,255,0.5)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
              <User className="w-7 h-7 text-sol-bgDeep" strokeWidth={2.2} />
            </div>
            <h3 className="font-display font-semibold text-xl mb-2">
              Vou me inscrever sozinho
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-5">
              Preencho só os meus dados e indico a trilha de preferência. A
              equipe é formada pela própria organização no dia do
              credenciamento, juntando todos os inscritos individuais
              presentes em equipes de 4 pessoas.
            </p>
            <ul className="space-y-1.5 text-sm text-white/60 mb-6">
              <li>• Só seus dados pessoais</li>
              <li>• Trilha de preferência</li>
              <li>• Aceite específico de formação por organização</li>
            </ul>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-sol-purpleLight group-hover:gap-3 transition-all">
              Selecionar este modo
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
        </button>
      </div>

      <p className="text-center text-white/50 text-xs mt-8">
        Pode mudar de escolha a qualquer momento antes de enviar a inscrição.
      </p>
    </section>
  );
}
