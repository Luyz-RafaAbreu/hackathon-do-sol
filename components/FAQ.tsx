"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "./Reveal";

// Cada resposta cita o item do Edital de origem entre parênteses pra dar
// rastreabilidade. Itens do Edital referenciados aqui:
//   3.1, 3.2, 3.4 (quem pode), 4.5/4.6 (equipes), 2.1/2.2 (data/local),
//   3.3 (período inscrições), 4.2/4.3 (confirmação/credenciamento),
//   3.3.4 (docs credenciamento), 4.13 (hospedagem), 4.13.3 (acomodação),
//   6.2 (alimentação/estrutura), 7.2/7.6 (premiação/mentoria),
//   8.2.1/8.2.3/8.2.5 (requisitos solução, pitch, critérios),
//   13 (uso de imagem/reality show).
const faqs = [
  {
    q: "Quem pode participar?",
    a: "Pessoas físicas brasileiras com 18 anos completos até 24/06/2026 (data do credenciamento) e experiência em pelo menos uma das áreas: desenvolvimento web/mobile, design gráfico, design digital (UX/UI), gestão de negócios, marketing ou IA/engenharias. Inscrição é nominativa e intransferível (itens 3.1 e 3.4 do Edital).",
  },
  {
    q: "Como funciona a inscrição? Posso me inscrever sozinho?",
    a: "A inscrição é por equipe fechada de 4 pessoas. Um integrante atua como líder e preenche os dados de todos os 4 na página de Inscrição. Equipes incompletas podem ser completadas pela organização excepcionalmente — entre em contato pelos canais oficiais antes de tentar enviar sem time fechado (item 4.5 do Edital).",
  },
  {
    q: "Qual o período de inscrição?",
    a: "De 20 de maio a 5 de junho de 2026 (até 23h59, horário de Brasília). A análise das inscrições roda de 6 a 10/06 e a lista de selecionados sai no dia 11/06 por e-mail e no site. Se houver mais de 160 inscritos, a seleção considera portfólio, perfil no LinkedIn e aderência ao tema do hackathon (item 3.3 do Edital).",
  },
  {
    q: "Onde acontece o evento?",
    a: "100% presencial, no Hotel Praiamar Arena — Av. Senador Salgado Filho, 1906, Lagoa Nova, Natal/RN (CEP 59075-000). Toda a programação acontece dentro do hotel, da abertura ao encerramento (item 2.2 do Edital).",
  },
  {
    q: "Hospedagem e alimentação estão inclusas?",
    a: "Sim, ambas. A organização disponibiliza hospedagem no Hotel Praiamar Arena durante os 3 dias do evento, sem custo, e oferece café da manhã, almoço, café da tarde e jantar diariamente, além de água e bebidas não alcoólicas durante toda a programação. Transporte até Natal fica por conta do participante (itens 4.13 e 6.2 do Edital).",
  },
  {
    q: "Como funciona a divisão dos quartos?",
    a: "Quartos são coletivos, com capacidade para 4 pessoas em 2 camas de casal (cada cama compartilhada por 2 participantes do mesmo gênero). Equipes do mesmo gênero ficam no mesmo quarto. Equipes mistas são recombinadas com outras equipes mistas, sempre mantendo quartos exclusivamente do mesmo gênero. A organização respeita a identidade de gênero declarada na inscrição; situações específicas (não-binário, restrições médicas, religiosas) devem ser informadas com 10 dias de antecedência (item 4.13.3 do Edital).",
  },
  {
    q: "O que preciso levar?",
    a: "Notebook ou laptop é OBRIGATÓRIO (sob pena de desclassificação). No credenciamento (24/06, das 10h às 14h) traga: documento original com foto válido em território nacional (RG, CNH ou passaporte) e o e-mail de confirmação da inscrição, impresso ou digital. Roupa para 3 dias, carregadores e itens de higiene pessoal completam o básico (itens 3.3.4, 4.7 e 4.14 do Edital).",
  },
  {
    q: "O que a minha equipe precisa entregar?",
    a: "Uma aplicação 100% web ou mobile, publicada em ambiente de produção ou homologação acessível por link, mais a pasta de documentação do projeto. Tudo entregue até 28/06 às 13h59. O uso de IA Generativa (Claude, ChatGPT, Copilot, Gemini etc.) é incentivado. A solução deve ser original e desenvolvida durante o evento — projetos prontos antes da abertura não são aceitos (itens 8.2.1 e 11.9 do Edital).",
  },
  {
    q: "Como são os pitches e a avaliação?",
    a: "No domingo, das 14h às 18h, cada equipe faz um pitch de até 3 minutos para a banca julgadora. A nota total é de até 24 pontos, somando 6 critérios: potencial de impacto, modelo de negócio, aderência ao desafio, inovação, qualidade do pitch e critério técnico da solução. Decisões da banca são soberanas e irrecorríveis (item 8.2 do Edital).",
  },
  {
    q: "Qual é a premiação?",
    a: "Premiação total de R$ 10 mil dividida entre as 3 melhores equipes — R$ 5 mil para o 1º, R$ 3 mil para o 2º e R$ 2 mil para o 3º — com valores divididos igualmente entre os 4 integrantes da equipe vencedora, pagos em até 30 dias após o evento. Além disso, as 3 equipes vencedoras recebem mentoria gratuita por 2 meses pós-evento (item 7 do Edital).",
  },
  {
    q: "O evento será gravado?",
    a: "Sim. O Hackathon do Sol tem natureza audiovisual e poderá integrar o documentário oficial do evento, o reality show \"Inovação em Ação\" e materiais de divulgação em redes sociais (Reels, Shorts, Stories, etc.). A autorização de uso de imagem, voz, nome e participação é condição essencial da inscrição, conforme a Seção 13 do Edital.",
  },
  {
    q: "Como são as trilhas temáticas?",
    a: "Três trilhas oficiais: (1) Turismo Inteligente e Experiências do Sol, (2) Tecnologia para o Bem e Impacto Social, (3) Supermercados do Futuro e Varejo Inteligente. A equipe indica a trilha de preferência na inscrição; a organização pode validar ou ajustar a distribuição entre as trilhas conforme equilíbrio, perfil técnico e aderência (item 5.3 do Edital).",
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
        <div className="max-w-3xl mb-6 rounded-2xl border border-sol-orange/30 bg-sol-orange/5 backdrop-blur-sm px-5 py-4 text-sm text-white/80 leading-relaxed">
          <strong className="text-sol-orange">📄 Baseado no Edital oficial.</strong>{" "}
          As respostas abaixo seguem o regulamento do Hackathon do Sol 2026. Em
          caso de divergência, prevalece sempre o texto do{" "}
          <a
            href="/termos-e-privacidade"
            className="text-sol-orange underline underline-offset-2 hover:text-white transition"
          >
            Edital
          </a>
          .
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
