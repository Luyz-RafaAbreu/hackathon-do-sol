import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import FloatingActions from "@/components/FloatingActions";
import ParticlesCanvas from "@/components/ParticlesCanvas";
import { getInscriptionsStatus } from "@/lib/inscriptions";
import { EVENT } from "@/lib/event";

export const metadata: Metadata = {
  title: `Termos e Privacidade | ${EVENT.NAME}`,
  description: `Termos de uso e política de privacidade do ${EVENT.NAME}.`,
  alternates: { canonical: "/termos-e-privacidade" },
};

export default async function TermosEPrivacidadePage() {
  const { open: inscriptionsOpen } = await getInscriptionsStatus();

  return (
    <>
      <ParticlesCanvas />
      <main className="relative z-10 overflow-x-hidden">
        <ScrollProgress />
        <Header inscriptionsOpen={inscriptionsOpen} />

        <section className="relative px-6 md:px-10 max-w-3xl mx-auto pt-32 md:pt-40 pb-20 md:pb-24">
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 md:p-12 text-center overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink"
            />
            <div
              aria-hidden
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-sol-orange/8 blur-3xl pointer-events-none"
            />

            <div className="relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sol-orange/10 border border-sol-orange/30 mb-6">
                <FileText className="w-6 h-6 text-sol-orange" strokeWidth={2} />
              </div>

              <h1 className="font-display font-bold text-2xl md:text-3xl mb-4">
                Termos e Privacidade
              </h1>

              <p className="text-white/75 leading-relaxed text-sm md:text-base max-w-md mx-auto mb-3">
                Conteúdo em construção.
              </p>
              <p className="text-white/55 leading-relaxed text-sm max-w-md mx-auto mb-7">
                Os termos de uso e a política de privacidade definitivos serão
                publicados aqui assim que o edital oficial do evento for
                divulgado.
              </p>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-sol-orange/40 bg-sol-orange/5 text-sol-orange font-semibold px-5 py-2.5 text-sm hover:border-sol-orange hover:bg-sol-orange/10 transition"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                <span>Voltar pra home</span>
              </Link>
            </div>
          </div>
        </section>

        <Footer />
        <FloatingActions />
      </main>
    </>
  );
}
