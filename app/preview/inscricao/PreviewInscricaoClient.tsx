"use client";
import { useState } from "react";
import InscricaoSelector, {
  type InscricaoModo,
} from "@/components/InscricaoSelector";
import InscricaoIndividual from "@/components/InscricaoIndividual";

export default function PreviewInscricaoClient() {
  const [modo, setModo] = useState<InscricaoModo | "selector">("selector");

  if (modo === "selector") {
    return <InscricaoSelector onSelect={(m) => setModo(m)} />;
  }
  if (modo === "individual") {
    return (
      <InscricaoIndividual
        onBack={() => setModo("selector")}
        previewMode
      />
    );
  }
  // modo === "equipe" — pro preview, mostra um placeholder pra não importar
  // o Inscricao real (que tem dependências de auth/turnstile).
  return (
    <section className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24">
      <div className="card text-center py-12">
        <span className="eyebrow">Preview</span>
        <h2 className="section-title">Equipe — fluxo atual</h2>
        <p className="section-subtitle">
          Aqui entraria o wizard de 9 etapas existente (não renderizado neste
          preview pra evitar dependências de auth/Turnstile).
        </p>
        <button
          type="button"
          onClick={() => setModo("selector")}
          className="mt-6 inline-flex items-center text-sm text-sol-orange hover:underline"
        >
          ← voltar ao seletor
        </button>
      </div>
    </section>
  );
}
