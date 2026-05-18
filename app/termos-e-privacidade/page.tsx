import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import FloatingActions from "@/components/FloatingActions";
import ParticlesCanvas from "@/components/ParticlesCanvas";
import { getInscriptionsStatus } from "@/lib/inscriptions";
import { EVENT } from "@/lib/event";

export const metadata: Metadata = {
  title: `Termos e Privacidade | ${EVENT.NAME}`,
  description: `Termos de uso, política de privacidade (LGPD) e autorização de uso de imagem do ${EVENT.NAME}, com base no Edital oficial.`,
  alternates: { canonical: "/termos-e-privacidade" },
};

// Conteúdo desta página é uma síntese das Seções 10 (código de conduta +
// propriedade intelectual), 12 (LGPD) e 13 (imagem/reality show) do Edital
// oficial do Hackathon do Sol 2026. Em caso de divergência entre o texto
// abaixo e o Edital, prevalece sempre o Edital.
export default async function TermosEPrivacidadePage() {
  const { open: inscriptionsOpen } = await getInscriptionsStatus();

  return (
    <>
      <ParticlesCanvas />
      <main className="relative z-10 overflow-x-hidden">
        <ScrollProgress />
        <Header inscriptionsOpen={inscriptionsOpen} />

        <section className="relative px-6 md:px-10 max-w-3xl mx-auto pt-32 md:pt-40 pb-20 md:pb-24">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-sol-orange transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            <span>Voltar pra home</span>
          </Link>

          <div className="mb-10">
            <span className="eyebrow">Documentação legal</span>
            <h1 className="font-display font-bold text-3xl md:text-4xl leading-tight tracking-tight mb-3">
              Termos e Privacidade
            </h1>
            <p className="text-white/65 text-sm md:text-base leading-relaxed">
              Esta página resume os termos de uso, a política de privacidade
              (LGPD) e a autorização de uso de imagem do {EVENT.NAME}{" "}
              {EVENT.YEAR}, conforme as Seções 10, 12 e 13 do Edital oficial.
              Em caso de divergência, prevalece o texto do Edital.
            </p>
          </div>

          <div className="space-y-10 text-white/80 text-[0.9375rem] leading-relaxed">
            <Bloco titulo="1. Aceite do Edital">
              <p>
                Ao se inscrever no {EVENT.NAME}, o participante declara que leu,
                compreendeu e aceitou integralmente o Edital — incluindo regras
                de inscrição, participação, permanência, julgamento, premiação,
                propriedade intelectual, código de conduta e uso de imagem.
              </p>
              <p>
                A aceitação eletrônica dos termos no formulário tem plena
                validade jurídica. A organização poderá exigir, no
                credenciamento presencial em 24/06/2026, a assinatura física
                do Termo de Autorização de Uso de Imagem, Voz, Nome e
                Depoimento.
              </p>
            </Bloco>

            <Bloco titulo="2. Quem realiza o evento">
              <p>
                O {EVENT.NAME} é um concurso cultural promovido pela{" "}
                <strong className="text-white">Convívia LTDA</strong>, com sede
                em São Caetano do Sul/SP. Em conformidade com o art. 3º da Lei
                nº 5.768/71, o concurso tem finalidade exclusivamente cultural,
                sem caráter comercial e não vinculado à aquisição de produtos
                ou serviços.
              </p>
            </Bloco>

            <Bloco titulo="3. Código de conduta e anti-assédio">
              <p>
                O {EVENT.NAME} é dedicado a oferecer uma experiência livre de
                assédio para todos, independentemente de raça, sexo, idade,
                orientação sexual, deficiência, aparência física, origem,
                etnia ou religião.
              </p>
              <p>
                São considerados assédio: comentários ofensivos, ameaças,
                xingamentos, imagens sexualizadas, intimidação deliberada,
                perseguição, fotografia ou gravação sem consentimento, contato
                físico inadequado e atenção sexual indesejada — tanto
                presencialmente quanto em comunicações online relacionadas ao
                evento.
              </p>
              <p>
                Patrocinadores, parceiros, mentores e voluntários estão
                igualmente sujeitos à política. Casos serão analisados pela
                comissão organizadora e podem resultar em advertência,
                desclassificação ou retirada do participante.
              </p>
            </Bloco>

            <Bloco titulo="4. Propriedade intelectual">
              <p>
                <strong className="text-white">
                  Os projetos desenvolvidos durante o {EVENT.NAME} pertencem às
                  equipes que os criaram.
                </strong>{" "}
                A organização incentiva — mas não obriga — a abertura do código
                como open source para fomentar a comunidade.
              </p>
              <p>Ao participar, cada equipe garante que:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-white/75">
                <li>
                  Não submeterá conteúdo protegido por direitos autorais ou
                  segredo comercial de terceiros sem autorização do legítimo
                  proprietário;
                </li>
                <li>
                  Não publicará material ilegal, obsceno, difamatório,
                  ameaçador, pornográfico, ofensivo ou que viole direitos de
                  imagem;
                </li>
                <li>
                  Não inserirá no projeto vírus, malware ou outros dispositivos
                  nocivos;
                </li>
                <li>
                  Verificará e respeitará os termos de uso de bibliotecas,
                  APIs, bases de dados e ferramentas de IA generativa
                  utilizadas;
                </li>
                <li>
                  Não submeterá solução copiada, reproduzida ou desenvolvida
                  antes do primeiro dia do hackathon (sob pena de
                  desclassificação).
                </li>
              </ul>
            </Bloco>

            <Bloco titulo="5. Privacidade e proteção de dados (LGPD)">
              <p>
                A Convívia LTDA, como controladora, atua em conformidade com a
                Lei nº 13.709/2018 (LGPD), assumindo o compromisso de proteger
                os dados pessoais fornecidos no ato da inscrição.
              </p>
              <p>
                <strong className="text-white">Dados coletados:</strong> nome,
                CPF, RG, data de nascimento, e-mail, telefone, endereço,
                dados profissionais (LinkedIn, portfólio, ocupação,
                experiência), gênero (para alocação dos quartos), restrições
                alimentares e de saúde (para bem-estar no evento), contato de
                emergência e dados bancários (apenas para vencedores, para
                pagamento da premiação).
              </p>
              <p>
                <strong className="text-white">Finalidades:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-white/75">
                <li>Comunicação oficial sobre o evento;</li>
                <li>Viabilizar a participação do inscrito;</li>
                <li>Pagamento da premiação às equipes vencedoras;</li>
                <li>
                  Divulgação de resultados, fotos e vídeos (mediante
                  autorização expressa no ato da inscrição);
                </li>
                <li>Cumprimento de obrigações legais e regulatórias.</li>
              </ul>
              <p>
                <strong className="text-white">Compartilhamento:</strong> os
                dados podem ser compartilhados com a Comunidade Hackathon
                Brasil e com prestadores de serviço contratados (plataformas
                de inscrição, instituições financeiras), exclusivamente nas
                funções necessárias à realização do evento.
              </p>
              <p>
                <strong className="text-white">Direitos do titular:</strong> a
                qualquer momento, você pode exercer os direitos previstos no
                art. 18 da LGPD — acesso, correção, anonimização, eliminação,
                portabilidade, entre outros — solicitando por escrito à
                Convívia LTDA pelos canais oficiais do evento.
              </p>
            </Bloco>

            <Bloco titulo="6. Autorização de uso de imagem, voz e participação audiovisual">
              <p>
                O {EVENT.NAME} tem natureza{" "}
                <strong className="text-white">
                  competitiva, presencial, colaborativa e audiovisual
                </strong>
                . O evento é integralmente registrado e pode integrar produções
                audiovisuais em formato de documentário, reality show, série,
                vídeos curtos e materiais promocionais.
              </p>
              <p>
                <strong className="text-white">
                  Ao se inscrever, o participante autoriza:
                </strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-white/75">
                <li>
                  Uso de imagem, voz, nome, depoimentos, entrevistas, falas,
                  reações e participação no <em>documentário oficial</em> do
                  Hackathon do Sol;
                </li>
                <li>
                  Uso da imagem na produção audiovisual{" "}
                  <em>&quot;Inovação em Ação&quot;</em>, em formato de reality
                  show / documentário sobre o ecossistema de inovação do Rio
                  Grande do Norte;
                </li>
                <li>
                  Veiculação em Reels, Shorts, Stories e publicações em tempo
                  real nos perfis oficiais e dos parceiros do evento;
                </li>
                <li>
                  Uso em materiais de divulgação, captação de patrocínio,
                  prestação de contas e portfólio institucional, no Brasil e
                  no exterior, por prazo indeterminado.
                </li>
              </ul>
              <p>
                A autorização é gratuita e definitiva, sem direito a cachê,
                royalty, indenização ou compensação financeira adicional. A
                organização compromete-se a não usar a imagem do participante
                de forma deliberadamente ofensiva, discriminatória ou
                vexatória.
              </p>
              <p>
                A presença do participante nos ambientes do evento (salas,
                auditórios, áreas comuns, quartos compartilhados de
                convivência) implica ciência de que poderá haver captação
                audiovisual por câmeras, microfones, drones, fotógrafos e
                equipes de produção.
              </p>
              <p className="text-sm text-white/65">
                Esta autorização é{" "}
                <strong className="text-white">condição essencial</strong> para
                inscrição, permanência e participação no evento.
              </p>
            </Bloco>

            <Bloco titulo="7. Presença obrigatória e regras de permanência">
              <p>
                A permanência integral nas dependências do hotel durante a
                programação oficial é{" "}
                <strong className="text-white">obrigatória</strong>. Ausências
                injustificadas, saída sem comunicação prévia ou recusa em
                participar das atividades obrigatórias (palestras, mentorias,
                dinâmicas, gravações, pitches, premiação) podem ensejar
                advertência, perda de pontuação, desclassificação ou
                eliminação.
              </p>
              <p>
                Casos de ausência por força maior, emergência médica ou
                família devem ser comunicados imediatamente à comissão
                organizadora.
              </p>
            </Bloco>

            <Bloco titulo="8. Hospedagem coletiva">
              <p>
                A hospedagem é coletiva, em quartos do Hotel Praiamar Arena com
                capacidade para 4 pessoas em 2 camas de casal. Cada cama de
                casal é compartilhada por 2 participantes do mesmo gênero.
              </p>
              <p>
                Equipes do mesmo gênero permanecem juntas em um quarto. Equipes
                mistas são recombinadas com outras equipes mistas, mantendo
                quartos exclusivamente de mesmo gênero, conforme identidade
                declarada na inscrição.
              </p>
              <p>
                Situações específicas (identidade não-binária, restrições
                médicas, religiosas ou de mobilidade) devem ser informadas com{" "}
                <strong className="text-white">
                  no mínimo 10 dias de antecedência
                </strong>{" "}
                à organização, por escrito.
              </p>
              <p>
                Quem não concordar com as regras de acomodação coletiva pode
                providenciar hospedagem alternativa às próprias expensas, sem
                que isso o desobrigue da permanência nas dependências do hotel
                durante a programação oficial.
              </p>
            </Bloco>

            <Bloco titulo="9. Decisões soberanas e casos omissos">
              <p>
                As decisões da Banca Julgadora e da comissão organizadora são
                soberanas e irrecorríveis, não sendo cabível contestação dos
                resultados.
              </p>
              <p>
                Casos omissos neste regulamento serão julgados pela comissão
                organizadora.
              </p>
            </Bloco>

            <Bloco titulo="10. Contato e exercício de direitos">
              <p>
                Para exercer direitos previstos na LGPD ou tirar dúvidas sobre
                este documento, entre em contato pelo e-mail:{" "}
                <a
                  href="mailto:hackathondosol@gmail.com"
                  className="text-sol-orange underline underline-offset-2 hover:text-white transition"
                >
                  hackathondosol@gmail.com
                </a>
              </p>
              <p className="text-sm text-white/55">
                Última atualização: maio de {EVENT.YEAR}. Este resumo segue o
                Edital oficial do {EVENT.NAME}; em caso de qualquer divergência
                entre o texto desta página e o Edital, prevalece o Edital.
              </p>
            </Bloco>
          </div>
        </section>

        <Footer />
        <FloatingActions />
      </main>
    </>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-sm p-6 md:p-8 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sol-orange/40 to-transparent"
      />
      <header className="mb-4">
        <h2 className="font-display font-bold text-xl md:text-2xl text-white leading-tight">
          {titulo}
        </h2>
      </header>
      <div className="space-y-3">{children}</div>
    </article>
  );
}
