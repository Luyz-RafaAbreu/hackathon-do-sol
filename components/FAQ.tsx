"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "./Reveal";

// Respostas baseadas no Edital oficial do Hackathon do Sol 2026 — referência
// completa em [/termos-e-privacidade] e no Edital publicado pela organização.
const faqs = [
  {
    q: "Quem pode participar?",
    a: "Pessoas físicas brasileiras com 18 anos completos até 24/06/2026 (data do credenciamento) e experiência em pelo menos uma das áreas: desenvolvimento web/mobile, design gráfico, design digital (UX/UI), gestão de negócios, marketing ou IA/engenharias. Inscrição é nominativa e intransferível.",
  },
  {
    q: "Como funciona a inscrição? Posso me inscrever sozinho?",
    a: "A inscrição é por equipe de 4 pessoas: um integrante atua como líder e preenche os dados dos 4 na página de Inscrição. Se você ainda não tem equipe ou está com o time incompleto, fale com a organização pelos canais oficiais — a comissão organizadora ajuda a formar equipes e incluir participantes sem equipe.",
  },
  {
    q: "Qual o período de inscrição?",
    a: "De 22 de maio a 12 de junho de 2026 (até 23h59, horário de Brasília). A análise das inscrições roda de 13 a 17/06 e a lista de selecionados sai no dia 18/06 por e-mail e no site. Se houver mais de 160 inscritos, a seleção considera portfólio, perfil no LinkedIn e aderência ao tema do hackathon.",
  },
  {
    q: "Onde acontece o evento?",
    a: "100% presencial, no Hotel Praiamar Arena — Av. Senador Salgado Filho, 1906, Lagoa Nova, Natal/RN (CEP 59075-000). Toda a programação acontece dentro do hotel, da abertura ao encerramento.",
  },
  {
    q: "Hospedagem e alimentação estão inclusas?",
    a: "Sim, ambas. A organização disponibiliza hospedagem no Hotel Praiamar Arena durante os 3 dias do evento, sem custo, e oferece café da manhã, almoço e jantar diariamente, além de água e bebidas não alcoólicas durante toda a programação. Transporte até Natal fica por conta do participante.",
  },
  {
    q: "Como funciona a divisão dos quartos?",
    a: "Quartos são coletivos, com capacidade para 4 pessoas em 2 camas de casal (cada cama compartilhada por 2 participantes do mesmo gênero). Equipes do mesmo gênero ficam no mesmo quarto. Equipes mistas são recombinadas com outras equipes mistas, sempre mantendo quartos exclusivamente do mesmo gênero. A organização respeita a identidade de gênero declarada na inscrição; situações específicas (não-binário, restrições médicas, religiosas) devem ser informadas com 10 dias de antecedência.",
  },
  {
    q: "O que preciso levar?",
    a: "Notebook ou laptop é OBRIGATÓRIO (sob pena de desclassificação). No credenciamento (24/06, das 10h às 14h) traga 3 itens: (a) documento original com foto válido em território nacional — RG, CNH, passaporte ou carteira funcional reconhecida por lei; (b) o e-mail de confirmação da inscrição, impresso ou digital — ele é enviado à conta Google do líder, que deve repassá-lo a todos os integrantes; (c) comprovante de confirmação de presença. Para os dias do evento: roupa para 3 dias, carregadores e itens de higiene pessoal completam o básico.",
  },
  {
    q: "O que a minha equipe precisa entregar?",
    a: "Uma aplicação 100% web ou mobile, publicada em ambiente de produção ou homologação acessível por link, mais a pasta de documentação do projeto. Tudo entregue até 28/06 às 13h59. O uso de IA Generativa (Claude, ChatGPT, Copilot, Gemini etc.) é incentivado. A solução deve ser original e desenvolvida durante o evento — projetos prontos antes da abertura não são aceitos.",
  },
  {
    q: "Como são os pitches e a avaliação?",
    a: "No domingo, das 14h às 18h, cada equipe faz um pitch de até 3 minutos para a banca julgadora. A nota total é de até 24 pontos, somando 6 critérios: potencial de impacto, modelo de negócio, aderência ao desafio, inovação, qualidade do pitch e critério técnico da solução. Decisões da banca são soberanas e irrecorríveis.",
  },
  {
    q: "Qual é a premiação?",
    a: "Premiação total de R$ 21 mil em prêmios. Cada uma das 3 trilhas tem uma equipe campeã, que recebe R$ 3 mil em prêmios; a grande vencedora do evento leva, além disso, mais R$ 12 mil em prêmios — totalizando R$ 15 mil. As equipes vencedoras também recebem um programa de mentoria gratuito de 2 meses após o evento. O detalhamento completo está no Edital.",
  },
  {
    q: "O evento será gravado?",
    a: "Sim. O Hackathon do Sol tem natureza audiovisual e poderá integrar o documentário oficial do evento, o reality show \"Inovação em Ação\" e materiais de divulgação em redes sociais (Reels, Shorts, Stories, etc.). A autorização de uso de imagem, voz, nome e participação é condição essencial da inscrição.",
  },
  {
    q: "Como são as trilhas temáticas?",
    a: "Três trilhas oficiais: (1) Turismo, (2) Beneficência e (3) Varejo. A equipe indica a trilha de preferência na inscrição; a organização pode validar ou ajustar a distribuição entre as trilhas conforme equilíbrio, perfil técnico e aderência.",
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
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
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
