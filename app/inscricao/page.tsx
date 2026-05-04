import type { Metadata } from "next";
import Header from "@/components/Header";
import InscricaoIntro from "@/components/InscricaoIntro";
import Inscricao from "@/components/Inscricao";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import FloatingActions from "@/components/FloatingActions";
import ParticlesCanvas from "@/components/ParticlesCanvas";
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

export default function InscricaoPage() {
  return (
    <>
      <ParticlesCanvas />
      <main className="relative z-10 overflow-x-hidden">
        <ScrollProgress />
        <Header />
        {/* InscricaoIntro tem padding-top próprio que já compensa altura
            do header fixo + dá respiro pra hero — sem wrapper extra. */}
        <InscricaoIntro />
        <Inscricao />
        <Footer />
        <FloatingActions />
      </main>
    </>
  );
}
