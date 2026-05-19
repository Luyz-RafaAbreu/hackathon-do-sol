"use client";
// ============================================================================
// components/SignInModal.tsx — modal de login (overlay)
// ----------------------------------------------------------------------------
// Renderizado pelo SignInModalProvider quando algum CTA "Inscreva-se" é
// clicado sem sessão ativa. Gate de UX (não de segurança — APIs validam
// sessão server-side).
//
// Fechamento: X no canto, click no backdrop, ou ESC. Animação de entrada
// separada em overlay (fade) e card (fade + slide-up + scale).
// ============================================================================
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import SignInButton from "./SignInButton";

export default function SignInModal({ onClose }: { onClose: () => void }) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // ESC fecha + foco inicial vai pro X (acessibilidade)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloqueia scroll do body enquanto aberto. Restaura no unmount.
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
      aria-labelledby="signin-title"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[18vh] pb-6 md:pt-[20vh]"
    >
      {/* Backdrop — click fecha. Opacidade moderada (50%) com blur sutil pra
          home continuar minimamente visível ao fundo, evitando a sensação
          de "tela inteira tomada". */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[0.125rem] cursor-default animate-signin-overlay-in"
      />

      {/* Card — sem borda dura: ring branco fininho pra definir contorno
          + glow laranja externo pra dar a cor da marca sem virar moldura. */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white/[0.05] backdrop-blur-2xl px-6 py-7 md:px-7 md:py-8 ring-1 ring-white/10 shadow-[0_1.5rem_3.5rem_-0.75rem_rgba(0,0,0,0.55),0_0_3rem_-0.5rem_rgba(255,165,48,0.4)] overflow-hidden animate-signin-card-in">
        {/* Linha gradiente no topo */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink"
        />
        {/* Glow decorativo */}
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-sol-orange/12 blur-3xl pointer-events-none"
        />

        {/* Botão fechar — bem visível no canto */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-2.5 right-2.5 z-10 inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/65 hover:text-white hover:bg-white/[0.08] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sol-orange/60"
        >
          <X className="w-4 h-4" strokeWidth={2.4} />
        </button>

        <div className="relative text-center">
          <div className="inline-flex items-center gap-2 mb-4 rounded-full border bg-sol-orange/10 border-sol-orange/30 px-3 py-1">
            <span className="font-mono text-[0.6rem] md:text-[0.625rem] uppercase tracking-[0.22em] font-medium text-sol-orange">
              Passo 1 de 2 · Identificação
            </span>
          </div>

          <h2
            id="signin-title"
            className="font-display font-bold text-xl md:text-2xl leading-[1.15] tracking-tight mb-3"
          >
            Entre com sua{" "}
            <span className="text-gradient-animated">conta Google</span>
          </h2>

          <p className="text-white/60 text-[0.8125rem] md:text-sm leading-relaxed mb-6">
            Sem pressa: a gente salva seu progresso automaticamente. Pode
            pausar e voltar quando quiser.
          </p>

          <SignInButton callbackUrl="/inscricao" />
        </div>
      </div>
    </div>
  );
}
