import { Lock } from "lucide-react";

/**
 * Mostrado em /inscricao quando o flag de inscrições está fechado (admin
 * desmarcou a checkbox na planilha). Substitui o `<Inscricao />` (form).
 *
 * Mensagem vem da própria planilha — admin pode customizar pra cada cenário
 * (já lotou, vai abrir em data X, etc).
 */
export default function InscricoesEncerradas({ message }: { message: string }) {
  const fallbackMessage =
    "Inscrições encerradas. Siga @hackathondosol pra ficar por dentro da próxima edição.";
  const display = message.trim() || fallbackMessage;

  return (
    <section className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24">
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 md:p-12 text-center overflow-hidden">
        {/* Barra gradient no topo — mantém linguagem visual com o form */}
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
            <Lock className="w-6 h-6 text-sol-orange" strokeWidth={2} />
          </div>

          <h2 className="font-display font-bold text-2xl md:text-3xl mb-4">
            Inscrições encerradas
          </h2>

          <p className="text-white/75 leading-relaxed text-sm md:text-base max-w-md mx-auto mb-7">
            {display}
          </p>

          <a
            href="https://instagram.com/hackathondosol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-sol-orange/40 bg-sol-orange/5 text-sol-orange font-semibold px-5 py-2.5 text-sm hover:border-sol-orange hover:bg-sol-orange/10 transition"
          >
            {/* Lucide não tem ícone Instagram (removido por trademark) — SVG inline */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.247 2.242 1.308 3.608.058 1.266.069 1.646.069 4.85s-.011 3.584-.069 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.247-3.608 1.308-1.266.058-1.646.069-4.85.069s-3.584-.011-4.85-.069c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.247-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.247 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.141 0-3.51.012-4.747.068-.975.045-1.504.207-1.857.344-.467.181-.8.398-1.15.748-.35.35-.567.683-.748 1.15-.137.353-.299.882-.344 1.857C3.098 9.49 3.086 9.859 3.086 13s.012 3.51.068 4.747c.045.975.207 1.504.344 1.857.181.467.398.8.748 1.15.35.35.683.567 1.15.748.353.137.882.299 1.857.344 1.237.056 1.606.068 4.747.068s3.51-.012 4.747-.068c.975-.045 1.504-.207 1.857-.344.467-.181.8-.398 1.15-.748.35-.35.567-.683.748-1.15.137-.353.299-.882.344-1.857.056-1.237.068-1.606.068-4.747s-.012-3.51-.068-4.747c-.045-.975-.207-1.504-.344-1.857a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.299-1.857-.344C15.51 4.013 15.141 4.001 12 4.001zm0 3.136A4.863 4.863 0 1112 16.862 4.863 4.863 0 0112 7.137zm0 8.021a3.158 3.158 0 100-6.316 3.158 3.158 0 000 6.316zm6.188-8.224a1.137 1.137 0 11-2.274 0 1.137 1.137 0 012.274 0z" />
            </svg>
            <span>Seguir @hackathondosol</span>
          </a>
        </div>
      </div>
    </section>
  );
}
