import Image from "next/image";
import Reveal from "./Reveal";

// heightClass varia por logo: as mais "quadradas" precisam de mais altura pra
// ocupar o mesmo peso visual das mais horizontais.
const patrocinadores = [
  {
    nome: "Programa Djalma Maranhão",
    logo: "/patrocinadores/lei-djalma.png",
    w: 1803,
    h: 1056,
    heightClass: "max-h-20",
  },
  {
    nome: "Prefeitura de Natal",
    logo: "/patrocinadores/prefeitura.png",
    w: 2134,
    h: 746,
    heightClass: "max-h-14",
  },
];

export default function Patrocinadores() {
  return (
    <section id="patrocinadores" className="section !py-16">
      <Reveal>
        <div className="text-center mb-10">
          <span className="eyebrow">Patrocínio</span>
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            Quem torna o{" "}
            <span className="bg-gradient-to-r from-sol-yellow to-sol-orange bg-clip-text text-transparent">
              Hackathon do Sol
            </span>{" "}
            possível
          </h2>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur overflow-hidden max-w-2xl mx-auto">
          {/* glow central sutil */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sol-orange/10 to-transparent pointer-events-none" />
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[70%] h-32 bg-sol-pink/10 blur-3xl pointer-events-none" />

          <div className="relative p-6 md:p-12">
            <div className="flex flex-wrap items-center justify-center gap-5 md:gap-6">
              {patrocinadores.map((p) => (
                <div
                  key={p.nome}
                  className="group h-24 min-w-[14rem] px-8 flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] transition-all duration-500 hover:border-sol-orange/50 hover:from-white/[0.1] hover:-translate-y-1 hover:shadow-[0_1.25rem_2.5rem_-1.25rem_rgba(255,140,0,0.4)]"
                >
                  <Image
                    src={p.logo}
                    alt={p.nome}
                    width={p.w}
                    height={p.h}
                    className={`${p.heightClass} w-auto object-contain brightness-0 invert opacity-90 transition group-hover:opacity-100`}
                  />
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-white/45 mt-8 max-w-xl mx-auto">
              Interessado em apoiar o evento? Escreva para{" "}
              <a
                href="mailto:hackathondosol@gmail.com"
                className="text-white/70 hover:text-sol-orange transition underline underline-offset-4 decoration-white/20 hover:decoration-sol-orange"
              >
                hackathondosol@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
