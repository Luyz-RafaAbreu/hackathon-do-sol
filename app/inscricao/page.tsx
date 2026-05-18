import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Header from "@/components/Header";
import InscricaoIntro from "@/components/InscricaoIntro";
import Inscricao from "@/components/Inscricao";
import InscricoesEncerradas from "@/components/InscricoesEncerradas";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import FloatingActions from "@/components/FloatingActions";
import ParticlesCanvas from "@/components/ParticlesCanvas";
import { authOptions } from "@/lib/auth";
import { getInscriptionsStatus } from "@/lib/inscriptions";
import { EVENT } from "@/lib/event";

/**
 * Página dedicada à inscrição — único lugar do site com o formulário.
 * Acesso via /inscricao (link compartilhável curto, próprio pra anúncios
 * e analytics de conversão). Todos os CTAs "Inscreva-se" do site (Hero,
 * Header desktop, Header mobile menu) navegam pra cá.
 */
export const metadata: Metadata = {
  title: `Inscrição | ${EVENT.NAME}`,
  description: `Inscreva-se no ${EVENT.NAME} — ${EVENT.DATE_RANGE_LONG}, na ${EVENT.LOCATION_NAME} (${EVENT.CITY_STATE}). ${EVENT.SLOTS} vagas, inscrição gratuita.`,
  alternates: { canonical: "/inscricao" },
};

export default async function InscricaoPage() {
  const [{ open: inscriptionsOpen, message }, session] = await Promise.all([
    getInscriptionsStatus(),
    getServerSession(authOptions),
  ]);
  // Acesso direto via URL sem sessão: redireciona pra home com flag de
  // login. O SignInModalProvider detecta o ?login=1, abre o modal e limpa
  // o param. UX consistente com quem clicou em "Inscreva-se" na home.
  if (inscriptionsOpen && !session) {
    redirect("/?login=1");
  }
  return (
    <>
      <ParticlesCanvas />
      <main className="relative z-10 overflow-x-hidden">
        <ScrollProgress />
        <Header inscriptionsOpen={inscriptionsOpen} />
        {/* InscricaoIntro tem padding-top próprio que já compensa altura
            do header fixo + dá respiro pra hero — sem wrapper extra. */}
        <InscricaoIntro inscriptionsOpen={inscriptionsOpen} />
        {inscriptionsOpen ? (
          <Inscricao />
        ) : (
          <InscricoesEncerradas message={message} />
        )}
        <Footer />
        <FloatingActions />
      </main>
    </>
  );
}
