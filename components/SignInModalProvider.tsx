"use client";
// Provider global do modal de login. Vive no layout (envolve toda a árvore)
// pra que qualquer botão "Inscreva-se" possa abrir o modal sem navegar.
//
// Modal abre em duas situações:
//   1. Click manual em qualquer CTA "Inscreva-se" via useSignInModal().open()
//   2. Auto-abre ao chegar com ?login=1 na URL (usado quando alguém digita
//      /inscricao direto sem sessão — a página redireciona pra /?login=1)
//
// Modal NUNCA renderiza enquanto a sessão tá carregando (status="loading"),
// pra evitar piscar pro usuário que já está logado.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import SignInModal from "./SignInModal";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const SignInModalCtx = createContext<Ctx | null>(null);

export function useSignInModal(): Ctx {
  const ctx = useContext(SignInModalCtx);
  if (!ctx) {
    throw new Error("useSignInModal precisa estar dentro de <SignInModalProvider>");
  }
  return ctx;
}

export default function SignInModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { status } = useSession();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Auto-abre se ?login=1 estiver na URL — usado pelo redirect server-side
  // de /inscricao quando o usuário tenta acessar direto sem sessão. Remove
  // o param da URL depois pra não reabrir em refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "1") {
      setIsOpen(true);
      params.delete("login");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    }
  }, []);

  // Se o usuário fizer login com sucesso, fecha automaticamente. Útil
  // quando o popup OAuth completa e a navegação acontece em paralelo.
  useEffect(() => {
    if (status === "authenticated") setIsOpen(false);
  }, [status]);

  return (
    <SignInModalCtx.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen && status !== "authenticated" && <SignInModal onClose={close} />}
    </SignInModalCtx.Provider>
  );
}
