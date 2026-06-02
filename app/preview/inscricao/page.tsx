// ============================================================================
// app/preview/inscricao/page.tsx — preview DEV-ONLY do seletor e do fluxo
// individual. Não usar em produção: bypassa o gate de auth/já-inscrito pra
// permitir screenshots visuais.
//
// Em produção (`NODE_ENV === "production"`) retorna 404.
// ============================================================================
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PreviewInscricaoClient from "./PreviewInscricaoClient";

export default function PreviewInscricaoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="relative z-10 overflow-x-hidden">
      <Header inscriptionsOpen />
      <div className="pt-32 md:pt-40">
        <PreviewInscricaoClient />
      </div>
      <Footer />
    </main>
  );
}
