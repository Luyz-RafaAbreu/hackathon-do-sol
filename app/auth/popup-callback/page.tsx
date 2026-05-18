"use client";
// Página de aterrissagem do popup OAuth depois do Google → NextAuth callback.
// O cookie de sessão já foi setado quando chegamos aqui (na response do
// /api/auth/callback/google). Trabalho dessa página:
//   1. Avisar a janela principal via postMessage que o login completou
//      (sinal explícito — não depende de polling/getSession na main)
//   2. Fechar o popup
//
// Se a janela foi aberta manualmente (sem window.opener), o fallback
// redireciona pro /inscricao no próprio popup pra o usuário não ficar
// preso numa tela vazia.
import { useEffect } from "react";

// Sinal canônico de "auth completou" — mantém em sync com o listener em
// components/SignInButton.tsx (Next page files só podem exportar default +
// metadata, não dá pra exportar a const daqui).
const POPUP_AUTH_DONE = "hackathon-sol:auth-done";

export default function PopupCallbackPage() {
  useEffect(() => {
    // Pequeno delay pra estabilizar o cookie no jar do browser antes da
    // main consumir a mensagem (ela vai navegar full-reload em resposta).
    const id = window.setTimeout(() => {
      try {
        if (window.opener && !window.opener.closed) {
          // origin restrito ao próprio host por segurança
          window.opener.postMessage(POPUP_AUTH_DONE, window.location.origin);
        }
      } catch {
        /* opener pode estar inacessível por COOP em alguns hosts */
      }
      try {
        window.close();
      } catch {
        /* alguns browsers bloqueiam window.close em não-popups */
      }
      // Fallback: se window.close não fechou (ex: aba aberta direto), navega
      // pra /inscricao no próprio popup pra usuário não ficar preso.
      window.setTimeout(() => {
        window.location.href = "/inscricao";
      }, 1500);
    }, 150);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a0b3d] text-white">
      <div className="text-center">
        <p className="text-sm text-white/70">Login concluído. Pode fechar essa janela.</p>
      </div>
    </div>
  );
}
