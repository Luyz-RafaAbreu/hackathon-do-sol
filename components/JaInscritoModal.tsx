"use client";
// ============================================================================
// components/JaInscritoModal.tsx
// ----------------------------------------------------------------------------
// Pop-up centralizado de confirmação de inscrição. Dois usos:
//   - InscricaoGate → usuário JÁ TINHA enviado antes ("Inscrição já enviada").
//   - Inscricao.tsx → usuário ACABOU de enviar com sucesso ("Inscrição
//     enviada").
// Não é dispensável — o único caminho é voltar pra home. Reaproveita o visual
// do SignInModal (card com ring branco + glow laranja).
// ============================================================================
import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export default function JaInscritoModal({
  title = "Inscrição",
  titleHighlight = "já enviada",
  message = "Sua equipe já está inscrita no Hackathon do Sol. A inscrição vai passar pela análise da organização — o resultado chega no e-mail da conta Google do líder.",
}: {
  title?: string;
  titleHighlight?: string;
  message?: string;
}) {
  // Bloqueia scroll do body enquanto o pop-up está visível. Restaura no unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jainscrito-title"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[18vh] pb-6 md:pt-[20vh]"
    >
      {/* Backdrop — sem click-to-close: este pop-up é um bloqueio, não um
          overlay opcional. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/55 backdrop-blur-[0.125rem] animate-signin-overlay-in"
      />

      {/* Card — mesmo tratamento do SignInModal: ring branco fino + glow
          laranja externo. */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white/[0.05] backdrop-blur-2xl px-6 py-7 md:px-7 md:py-8 ring-1 ring-white/10 shadow-[0_1.5rem_3.5rem_-0.75rem_rgba(0,0,0,0.55),0_0_3rem_-0.5rem_rgba(255,165,48,0.4)] overflow-hidden animate-signin-card-in">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink"
        />
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-sol-orange/12 blur-3xl pointer-events-none"
        />

        <div className="relative text-center">
          <div className="mx-auto mb-4 inline-flex items-center justify-center w-14 h-14 rounded-full bg-sol-orange/12 ring-1 ring-sol-orange/30">
            <CheckCircle2 className="w-7 h-7 text-sol-orange" strokeWidth={2.2} />
          </div>

          <h2
            id="jainscrito-title"
            className="font-display font-bold text-xl md:text-2xl leading-[1.15] tracking-tight mb-3"
          >
            {title}{" "}
            <span className="text-gradient-animated">{titleHighlight}</span>
          </h2>

          <p className="text-white/60 text-[0.8125rem] md:text-sm leading-relaxed mb-6">
            {message}
          </p>

          <Link
            href="/"
            className="btn-primary group w-full text-sm md:text-base"
          >
            <ArrowLeft
              className="w-4 h-4 transition-transform group-hover:-translate-x-1"
              strokeWidth={2.5}
            />
            <span className="relative z-10">Voltar à página principal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
