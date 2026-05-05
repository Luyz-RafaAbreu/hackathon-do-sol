import { getInscriptionsStatus } from "@/lib/inscriptions";
import Header from "@/components/Header";
import ScrollProgress from "@/components/ScrollProgress";
import FloatingActions from "@/components/FloatingActions";
import ParticlesCanvas from "@/components/ParticlesCanvas";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Sobre from "@/components/Sobre";
import Informacoes from "@/components/Informacoes";
import Cronograma from "@/components/Cronograma";
import Materiais from "@/components/Materiais";
import FAQ from "@/components/FAQ";
import Patrocinadores from "@/components/Patrocinadores";
import Footer from "@/components/Footer";

export default async function Home() {
  const { open: inscriptionsOpen } = await getInscriptionsStatus();
  return (
    <>
      <ParticlesCanvas />
      <main className="relative z-10 overflow-x-hidden">
        <ScrollProgress />
        <Header inscriptionsOpen={inscriptionsOpen} />
        <Hero inscriptionsOpen={inscriptionsOpen} />
        <Marquee />
        <Sobre />
        <Informacoes />
        <Cronograma />
        <Materiais />
        <FAQ />
        <Patrocinadores />
        <Footer />
        <FloatingActions />
      </main>
    </>
  );
}
