import { FileText, ShieldCheck, Compass, Clock, ArrowRight, type LucideIcon } from "lucide-react";
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

// Edital + Termos já existem; PDF do Edital ainda não foi subido no projeto,
// então o card "Edital" segue como "Em breve" até o arquivo aparecer em
// public/materiais/edital.pdf. O resumo legal — código de conduta, LGPD,
// imagem — já está publicado em /termos-e-privacidade.
const materiais: MaterialItem[] = [
  {
    titulo: "Edital oficial",
    descricao:
      "Documento completo do Hackathon do Sol 2026, com regras de inscrição, premiação, julgamento, propriedade intelectual e anexos.",
    Icon: FileText,
    cor: "from-sol-yellow to-sol-orange",
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
  {
    titulo: "Guia do participante",
    descricao:
      "Dicas práticas, cronograma detalhado, o que levar e orientações de credenciamento. Divulgado às equipes selecionadas.",
    Icon: Compass,
    cor: "from-sol-pink to-sol-purpleLight",
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
            A síntese legal já está publicada em{" "}
            <Link
              href="/termos-e-privacidade"
              className="text-sol-orange hover:underline"
            >
              Termos e Privacidade
            </Link>
            . O Edital em PDF e o guia do participante são divulgados pelo{" "}
            <a
              href="https://instagram.com/hackathondosol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sol-orange hover:underline"
            >
              @hackathondosol
            </a>{" "}
            e por e-mail às equipes selecionadas.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {materiais.map((m, i) => (
          <Reveal key={m.titulo} delay={i * 120}>
            <TiltCard className="card group h-full relative overflow-hidden flex flex-col">
              {/* listra gradiente no topo */}
              <div
                className={`absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r ${m.cor}`}
              />
              {/* blob decorativo */}
              <div
                className={`absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br ${m.cor} opacity-10 blur-2xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-20`}
              />

              <div className="relative flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${m.cor} shadow-[0_0.5rem_1.25rem_-0.5rem_rgba(255,140,0,0.5)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`}
                  >
                    <m.Icon className="w-6 h-6 text-sol-bgDeep" strokeWidth={2.2} />
                  </div>
                  {m.href ? (
                    <span className="relative inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.25em] font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-3 py-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      Disponível
                    </span>
                  ) : (
                    <span className="relative inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.25em] font-semibold text-sol-orange bg-sol-orange/10 border border-sol-orange/30 rounded-full px-3 py-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-sol-orange opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sol-orange" />
                      </span>
                      Em breve
                    </span>
                  )}
                </div>

                <h3 className="font-display font-semibold text-lg mb-2">
                  {m.titulo}
                </h3>
                <p className="text-white/65 text-sm flex-1 mb-5 leading-relaxed">
                  {m.descricao}
                </p>

                {m.href ? (
                  <Link
                    href={m.href}
                    className="inline-flex items-center gap-2 text-sol-orange font-semibold text-sm pt-3 border-t border-white/[0.06] hover:gap-3 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                    {m.ctaLabel ?? "Acessar"}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 text-white/35 font-semibold text-sm cursor-not-allowed pt-3 border-t border-white/[0.06]">
                    <Clock className="w-4 h-4" strokeWidth={2} />
                    Disponível em breve
                  </span>
                )}
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
