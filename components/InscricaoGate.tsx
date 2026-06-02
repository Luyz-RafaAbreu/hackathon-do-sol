"use client";
// ============================================================================
// components/InscricaoGate.tsx
// ----------------------------------------------------------------------------
// Decide o que renderizar na página /inscricao com base em `useInscricaoStatus`:
//   - loading    → spinner (ainda consultando se já há inscrição)
//   - jaInscrito → JaInscritoModal (bloqueia o formulário)
//   - resto      → seletor de modo, depois o wizard apropriado
//                  (equipe = atual, individual = novo, aditivo do Edital)
// `error` cai no caminho do wizard de propósito: se a consulta falhar, é melhor
// deixar a pessoa preencher do que bloquear injustamente (o dedup por CPF no
// backend ainda barra inscrição duplicada).
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { useInscricaoStatus } from "./InscricaoStatusProvider";
import JaInscritoModal from "./JaInscritoModal";
import Inscricao from "./Inscricao";
import InscricaoSelector, { type InscricaoModo } from "./InscricaoSelector";
import InscricaoIndividual from "./InscricaoIndividual";

// Persiste a escolha do modo entre refreshes — sem isso a pessoa cairia no
// seletor toda vez que recarregasse a página.
const MODO_KEY = "hackathon-sol-inscricao-modo-v1";

export default function InscricaoGate() {
  const { loading, jaInscrito, kind } = useInscricaoStatus();

  // Decide UMA vez, quando o status resolve, e trava a decisão. Se o usuário
  // enviar a inscrição depois (markInscrito → jaInscrito vira true), NÃO
  // trocamos o formulário pelo modal no meio do envio — o próprio Inscricao
  // mostra seu modal de "Inscrição enviada". O bloqueio "já enviada" passa a
  // valer numa nova visita à página, quando o Gate remonta.
  const decidedRef = useRef<"form" | "blocked" | null>(null);
  if (decidedRef.current === null && !loading) {
    decidedRef.current = jaInscrito ? "blocked" : "form";
  }

  // Modo de inscrição — restaurado do localStorage no mount.
  // `null` durante o 1º render do client (evita flash de "seletor" quando
  // a pessoa já tinha escolhido). Vira "selector" se nada estava salvo.
  const [modo, setModo] = useState<InscricaoModo | "selector" | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODO_KEY);
      if (saved === "equipe" || saved === "individual") {
        setModo(saved);
      } else {
        setModo("selector");
      }
    } catch {
      // localStorage indisponível (private mode, quota cheia) — mostra seletor.
      setModo("selector");
    }
  }, []);

  const handleSelect = (m: InscricaoModo) => {
    try {
      localStorage.setItem(MODO_KEY, m);
    } catch {
      /* */
    }
    setModo(m);
  };

  const handleBackToSelector = () => {
    try {
      localStorage.removeItem(MODO_KEY);
    } catch {
      /* */
    }
    setModo("selector");
  };

  if (decidedRef.current === null || modo === null) {
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
    // Texto adaptativo conforme a modalidade encontrada. `kind` pode ser
    // null se a inscrição foi feita em versão anterior da planilha (sem
    // discriminar) — cai no texto padrão de equipe.
    const individual = kind === "individual";
    return (
      <JaInscritoModal
        message={
          individual
            ? "Sua inscrição individual já está registrada no Hackathon do Sol. A organização vai analisar e o resultado chega no e-mail desta conta Google."
            : "Sua equipe já está inscrita no Hackathon do Sol. A inscrição vai passar pela análise da organização — o resultado chega no e-mail da conta Google do líder."
        }
      />
    );
  }

  if (modo === "selector") {
    return <InscricaoSelector onSelect={handleSelect} />;
  }

  if (modo === "individual") {
    return <InscricaoIndividual onBack={handleBackToSelector} />;
  }

  // modo === "equipe"
  return <Inscricao />;
}
