import { FileText, ShieldCheck, Clock, ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import Reveal from "./Reveal";
import TiltCard from "./TiltCard";

type MaterialItem = {
  titulo: string;
  descricao: string;
  Icon: LucideIcon;
  cor: string;
  href?: string;        // disponível agora
  ctaLabel?: string;    // texto do CTA quando disponível
};

// "Edital oficial" → PDF (download/abre em outra aba), texto original do
// regulamento com cabeçalho institucional. "Termos e Privacidade" → página
// HTML com síntese das seções 10/12/13 (LGPD, código de conduta, uso de
// imagem) — mais leve e fácil de linkar/atualizar do que tocar no PDF.
const materiais: MaterialItem[] = [
  {
    titulo: "Edital oficial",
    descricao:
      "Regras completas do Hackathon do Sol 2026: inscrição, premiação, julgamento, propriedade intelectual e código de conduta.",
    Icon: FileText,
    cor: "from-sol-yellow to-sol-orange",
    href: "/materiais/edital.pdf",
    ctaLabel: "Baixar PDF",
  },
  {
    titulo: "Termos e Privacidade",
    descricao:
      "Síntese pública das Seções 10, 12 e 13 do Edital — código de conduta, LGPD e autorização de uso de imagem.",
    Icon: ShieldCheck,
    cor: "from-sol-orange to-sol-pink",
    href: "/termos-e-privacidade",
    ctaLabel: "Ler agora",
  },
];

export default function Materiais() {
  return (
    <section id="materiais" className="section">
      <Reveal>
        <div className="mb-12">
          <span className="eyebrow">Materiais</span>
          <h2 className="section-title">Documentos oficiais do evento</h2>
          <p className="section-subtitle">
            Documentos oficiais do Hackathon do Sol 2026. Para dúvidas
            adicionais, fale com a organização pelo{" "}
            <a
              href="https://instagram.com/hackathondosol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sol-orange hover:underline"
            >
              @hackathondosol
            </a>
            .
          </p>
        </div>
      </Reveal>

      {/* Cards horizontais empilhados — 2 itens em grid 2-col fica com peso
          visual estranho. Layout horizontal (icon | texto | CTA) preenche a
          largura e dá hierarquia clara. */}
      <div className="space-y-5 max-w-4xl mx-auto">
        {materiais.map((m, i) => (
          <Reveal key={m.titulo} delay={i * 120}>
            <TiltCard className="card group relative overflow-hidden">
              {/* listra gradiente lateral esquerda (em vez de no topo) — combina
                  com a leitura horizontal do card */}
              <div
                className={`absolute inset-y-0 left-0 w-[0.1875rem] bg-gradient-to-b ${m.cor}`}
              />
              {/* blob decorativo no canto direito */}
              <div
                className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${m.cor} opacity-10 blur-2xl transition-all duration-700 group-hover:scale-125 group-hover:opacity-20`}
              />

              <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-6 pl-2">
                {/* ícone */}
                <div
                  className={`shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${m.cor} shadow-[0_0.5rem_1.25rem_-0.5rem_rgba(255,140,0,0.5)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3`}
                >
                  <m.Icon className="w-7 h-7 text-sol-bgDeep" strokeWidth={2.2} />
                </div>

                {/* corpo: título + status (no topo) + descrição */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <h3 className="font-display font-semibold text-lg md:text-xl text-white">
                      {m.titulo}
                    </h3>
                    {m.href ? (
                      <span className="relative inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.22em] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2.5 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                        </span>
                        Disponível
                      </span>
                    ) : (
                      <span className="relative inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.22em] font-semibold text-sol-orange bg-sol-orange/10 border border-sol-orange/30 rounded-full px-2.5 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sol-orange" />
                        </span>
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-white/65 text-sm md:text-[0.9375rem] leading-relaxed">
                    {m.descricao}
                  </p>
                </div>

                {/* CTA — empurrado pra direita no desktop. PDFs abrem em nova
                    aba (UX padrão de download/visualização) e ganham hint
                    visual via target="_blank". */}
                <div className="shrink-0 md:ml-auto">
                  {m.href ? (
                    <Link
                      href={m.href}
                      target={m.href.endsWith(".pdf") ? "_blank" : undefined}
                      rel={m.href.endsWith(".pdf") ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-2 rounded-full border-[0.125rem] border-sol-orange/50 bg-sol-orange/10 text-sol-orange font-semibold px-5 py-2.5 text-sm hover:border-sol-orange hover:bg-sol-orange/15 hover:gap-3 transition-all"
                    >
                      <span>{m.ctaLabel ?? "Acessar"}</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border-[0.125rem] border-white/10 bg-white/[0.03] text-white/45 font-semibold px-5 py-2.5 text-sm cursor-not-allowed">
                      <Clock className="w-4 h-4" strokeWidth={2} />
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
