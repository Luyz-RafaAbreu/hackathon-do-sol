"use client";
// ============================================================================
// components/InscricaoGate.tsx
// ----------------------------------------------------------------------------
// Decide o que renderizar na página /inscricao com base em `useInscricaoStatus`:
//   - loading    → spinner (ainda consultando se já há inscrição)
//   - jaInscrito → JaInscritoModal (bloqueia o formulário)
//   - resto      → o wizard de inscrição
// `error` cai no caminho do wizard de propósito: se a consulta falhar, é melhor
// deixar a pessoa preencher do que bloquear injustamente (o dedup por CPF no
// backend ainda barra inscrição duplicada).
// ============================================================================
import { useRef } from "react";
import { useInscricaoStatus } from "./InscricaoStatusProvider";
import JaInscritoModal from "./JaInscritoModal";
import Inscricao from "./Inscricao";

export default function InscricaoGate() {
  const { loading, jaInscrito } = useInscricaoStatus();

  // Decide UMA vez, quando o status resolve, e trava a decisão. Se o usuário
  // enviar a inscrição depois (markInscrito → jaInscrito vira true), NÃO
  // trocamos o formulário pelo modal no meio do envio — o próprio Inscricao
  // mostra seu modal de "Inscrição enviada". O bloqueio "já enviada" passa a
  // valer numa nova visita à página, quando o Gate remonta.
  const decidedRef = useRef<"form" | "blocked" | null>(null);
  if (decidedRef.current === null && !loading) {
    decidedRef.current = jaInscrito ? "blocked" : "form";
  }

  if (decidedRef.current === null) {
    return (
      <section className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div
            aria-hidden
            className="w-9 h-9 rounded-full border-[0.1875rem] border-white/15 border-t-sol-orange animate-spin"
          />
          <p className="text-white/55 text-sm">Carregando inscrição…</p>
        </div>
      </section>
    );
  }

  if (decidedRef.current === "blocked") {
    return <JaInscritoModal />;
  }

  return <Inscricao />;
}
