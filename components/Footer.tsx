import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative mt-10">
      {/* borda gradiente superior */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sol-orange/50 to-transparent" />
      {/* glow decorativo */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sol-orange/5 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-16 grid md:grid-cols-[1.3fr_1fr_1fr] gap-10">
        <div>
          <a href="#" className="group inline-flex items-center gap-3 font-display font-bold text-lg mb-4">
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <span className="absolute -inset-1 rounded-full bg-sol-orange/40 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
              <Image
                src="/imagens/logo.webp"
                alt="Hackathon do Sol"
                width={40}
                height={40}
                className="relative rounded-full"
              />
            </div>
            <span>
              Hackathon{" "}
              <span className="bg-gradient-to-r from-sol-yellow to-sol-orange bg-clip-text text-transparent">
                do Sol
              </span>
            </span>
          </a>
          <p className="text-white/55 text-sm leading-relaxed max-w-sm">
            Três dias de imersão em código, design e inovação, reunindo a
            comunidade tech do Nordeste em Natal/RN.
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold text-sm uppercase tracking-[0.2em] text-white/50 mb-4">
            Contato
          </h4>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <a
                href="mailto:hackathondosol@gmail.com"
                className="inline-flex items-center gap-2 hover:text-sol-orange transition group"
              >
                <svg
                  className="w-4 h-4 text-white/40 group-hover:text-sol-orange transition"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 5L2 7" />
                </svg>
                hackathondosol@gmail.com
              </a>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-white/40 mt-0.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>
                Praiamar Arena
                <br />
                Av. Senador Salgado Filho, 1906
                <br />
                Lagoa Nova, Natal/RN
                <br />
                CEP 59075-000
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-sm uppercase tracking-[0.2em] text-white/50 mb-4">
            Siga o evento
          </h4>
          <a
            href="https://instagram.com/hackathondosol"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 hover:border-sol-orange/50 hover:bg-white/[0.08] hover:text-white transition"
          >
            <svg
              className="w-5 h-5 text-sol-orange"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.247 2.242 1.308 3.608.058 1.266.069 1.646.069 4.85s-.011 3.584-.069 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.247-3.608 1.308-1.266.058-1.646.069-4.85.069s-3.584-.011-4.85-.069c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.247-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.247 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.141 0-3.51.012-4.747.068-.975.045-1.504.207-1.857.344-.467.181-.8.398-1.15.748-.35.35-.567.683-.748 1.15-.137.353-.299.882-.344 1.857C3.098 9.49 3.086 9.859 3.086 13s.012 3.51.068 4.747c.045.975.207 1.504.344 1.857.181.467.398.8.748 1.15.35.35.683.567 1.15.748.353.137.882.299 1.857.344 1.237.056 1.606.068 4.747.068s3.51-.012 4.747-.068c.975-.045 1.504-.207 1.857-.344.467-.181.8-.398 1.15-.748.35-.35.567-.683.748-1.15.137-.353.299-.882.344-1.857.056-1.237.068-1.606.068-4.747s-.012-3.51-.068-4.747c-.045-.975-.207-1.504-.344-1.857a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.299-1.857-.344C15.51 4.013 15.141 4.001 12 4.001zm0 3.136A4.863 4.863 0 1112 16.862 4.863 4.863 0 0112 7.137zm0 8.021a3.158 3.158 0 100-6.316 3.158 3.158 0 000 6.316zm6.188-8.224a1.137 1.137 0 11-2.274 0 1.137 1.137 0 012.274 0z" />
            </svg>
            <span>@hackathondosol</span>
            <svg
              className="w-3.5 h-3.5 text-white/40 group-hover:text-sol-orange group-hover:translate-x-0.5 transition"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>

      <div className="relative border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/45">
          <span>
            © {new Date().getFullYear()} Hackathon do Sol. Todos os direitos
            reservados.
          </span>
          <span className="tracking-[0.2em] uppercase">
            Natal · Rio Grande do Norte · Brasil
          </span>
        </div>
      </div>
    </footer>
  );
}
