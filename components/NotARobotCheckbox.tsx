"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * ⚠ ATENÇÃO — COMPONENTE DECORATIVO, NÃO PROTEGE CONTRA BOTS.
 * ════════════════════════════════════════════════════════════════════
 *  Imita o visual do "Não sou um robô" (reCAPTCHA / Turnstile) mas é
 *  100% UI: o clique só dispara um spinner fake e marca como verificado.
 *  Bot que ignora o JS passa direto sem ser barrado.
 *
 *  Pra virar proteção real:
 *    1. Criar conta no Cloudflare Turnstile (ou Google reCAPTCHA v2)
 *    2. Substituir esse componente pelo widget oficial (`<Turnstile />`)
 *    3. Receber o `token` no `onChange` e enviar no FormData da inscrição
 *    4. Em `app/api/inscricao/route.ts`, validar o token via fetch pra
 *       API de validação do provedor (com a Secret Key)
 *    5. Rejeitar a request se a validação falhar
 * ════════════════════════════════════════════════════════════════════
 */
export default function NotARobotCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [verifying, setVerifying] = useState(false);

  const handleClick = () => {
    if (checked || verifying) return;
    setVerifying(true);
    // Delay arbitrário pra parecer que tá processando alguma coisa.
    // Real Turnstile/reCAPTCHA leva ~500-1500ms.
    setTimeout(() => {
      setVerifying(false);
      onChange(true);
    }, 1200);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4 max-w-sm">
      <button
        type="button"
        onClick={handleClick}
        disabled={checked || verifying}
        className="flex items-center gap-3 group disabled:cursor-default"
        aria-label="Confirmar que não é um robô"
      >
        <div
          className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
            checked
              ? "border-sol-orange bg-sol-orange/15"
              : verifying
              ? "border-sol-orange/60 bg-white/[0.04]"
              : "border-white/30 bg-white/[0.04] group-hover:border-white/50"
          }`}
        >
          {verifying ? (
            <Loader2 className="w-4 h-4 text-sol-orange animate-spin" strokeWidth={2.5} />
          ) : checked ? (
            <Check className="w-4 h-4 text-sol-orange" strokeWidth={3} />
          ) : null}
        </div>
        <span className="text-sm text-white/85 select-none normal-case tracking-normal font-normal">
          Não sou um robô
        </span>
      </button>

      {/* Badge — sol mini no lugar do logo do Google */}
      <div className="flex flex-col items-center shrink-0">
        <div
          aria-hidden
          className="w-8 h-8 rounded-full mb-1"
          style={{
            background:
              "radial-gradient(circle, #fff7d4 0%, #ffd34f 28%, #ff8c00 68%, #ff6b00 100%)",
            boxShadow: "0 0 0.5rem rgba(255, 140, 0, 0.4)",
          }}
        />
        <span className="font-mono text-[0.5rem] text-white/45 leading-none">
          solCAPTCHA
        </span>
        <span className="font-mono text-[0.5rem] text-white/30 leading-tight mt-0.5">
          Privacidade · Termos
        </span>
      </div>
    </div>
  );
}
