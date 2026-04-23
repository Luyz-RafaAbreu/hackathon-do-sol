import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 mt-10">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 grid md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 font-display font-bold text-lg mb-3">
            <Image
              src="/imagens/logo.webp"
              alt="Hackathon do Sol"
              width={36}
              height={36}
              className="rounded-full shadow-glow"
            />
            <span>
              Hackathon <span className="text-sol-orange">do Sol</span>
            </span>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            Três dias de inovação, código e colaboração na Praiamar Arena —
            Natal/RN.
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-3">Contato</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>contato@hackathondosol.com.br</li>
            <li>(84) 00000-0000</li>
            <li>Praiamar Arena — Natal/RN</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-3">Redes sociais</h4>
          <ul className="flex gap-3 text-sm">
            {["Instagram", "LinkedIn", "X / Twitter"].map((r) => (
              <li key={r}>
                <a
                  href="#"
                  className="inline-flex px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:border-sol-orange hover:text-sol-orange transition"
                >
                  {r}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Hackathon do Sol. Todos os direitos
        reservados.
      </div>
    </footer>
  );
}
