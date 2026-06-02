"use client";
// ============================================================================
// components/InscricaoIndividual.tsx
// ----------------------------------------------------------------------------
// Renderiza o wizard de inscrição individual completo (3 etapas).
// A lógica fica no InscricaoIndividualWizard pra manter este componente
// como uma "fachada" estável usada pelo InscricaoGate.
// ============================================================================
import InscricaoIndividualWizard from "./InscricaoIndividualWizard";

type Props = {
  onBack: () => void;
  // `previewMode` é repassado pelo /preview/inscricao (rota dev-only).
  // Em produção sempre false → submit real bate em /api/inscricao-individual.
  previewMode?: boolean;
};

export default function InscricaoIndividual({ onBack, previewMode }: Props) {
  return <InscricaoIndividualWizard onBack={onBack} previewMode={previewMode} />;
}
