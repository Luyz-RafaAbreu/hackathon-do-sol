"use client";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Sinal que /auth/popup-callback envia via postMessage quando o login
// completa. Mantém em sync com o constante exportado lá.
const POPUP_AUTH_DONE = "hackathon-sol:auth-done";

// Botão "Entrar com Google" — abre OAuth num popup ao invés de fazer
// redirect full-page. Fluxo:
//
//   1. Click → window.open("/auth/popup-start") numa janela pequena
//   2. /auth/popup-start dispara signIn() do NextAuth → popup vai pro Google
//   3. Usuário autoriza no Google → popup volta pra /api/auth/callback/google
//      → NextAuth seta o cookie → popup vai pra /auth/popup-callback
//   4. /auth/popup-callback faz window.opener.postMessage("auth-done") + close
//   5. Janela principal recebe a message → full reload pra callbackUrl
//      (que renderiza com a sessão fresca via SSR)
//
// O postMessage é o sinal canônico de sucesso. Polling em popup.closed serve
// só pra detectar quando o usuário fecha o popup MANUALMENTE (cancelou) — aí
// só liberamos o botão sem navegar.
//
// Fallback: se popup blocker barrar o window.open, cai pro signIn() padrão
// que faz redirect full-page tradicional.
export default function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const cleanup = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    popupRef.current = null;
  };

  const handleClick = () => {
    setLoading(true);
    completedRef.current = false;

    const w = 500;
    const h = 650;
    const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);

    const popup = window.open(
      "/auth/popup-start",
      "hackathon-sol-auth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,location=no,resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      // Popup bloqueado pelo navegador — usa redirect full-page como fallback.
      signIn("google", { callbackUrl });
      return;
    }
    popupRef.current = popup;

    // Listener da mensagem do popup-callback. Verifica origin pra não
    // aceitar postMessage de janelas estranhas.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data !== POPUP_AUTH_DONE) return;
      completedRef.current = true;
      window.removeEventListener("message", onMessage);
      cleanup();
      // Full reload pra /inscricao — o servidor vê a sessão fresca e
      // renderiza o wizard.
      window.location.href = callbackUrl;
    };
    window.addEventListener("message", onMessage);

    // Polling backup pra detectar fechamento manual do popup (usuário
    // cancelou). Se a mensagem chegou primeiro, completedRef é true e
    // este branch fica como no-op.
    intervalRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(intervalRef.current!);
      intervalRef.current = null;
      // Se NÃO recebeu a mensagem de sucesso até aqui, é cancelamento.
      // Damos uma pequena folga (300ms) pra a mensagem ainda chegar caso
      // close e postMessage tenham acontecido na mesma vizinhança temporal.
      window.setTimeout(() => {
        if (completedRef.current) return;
        window.removeEventListener("message", onMessage);
        setLoading(false);
      }, 300);
    }, 400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="group relative inline-flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl bg-white text-zinc-900 font-medium text-[0.95rem] hover:bg-white/95 transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-black/20"
    >
      {loading ? (
        <span className="inline-block h-5 w-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      <span>{loading ? "Aguardando autorização…" : "Continuar com Google"}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
