"use client";
// ============================================================================
// components/InscricaoStatusProvider.tsx
// ----------------------------------------------------------------------------
// Descobre, uma vez por sessão, se o usuário logado JÁ ENVIOU uma inscrição.
// Consulta /api/inscricao/status (que bate no Apps Script). Expõe via hook
// `useInscricaoStatus()`:
//   - loading     — ainda consultando
//   - error       — a consulta falhou (trata como "não inscrito" pra não
//                   bloquear injustamente)
//   - status      — "Pendente" | "Aprovado" | "Reprovado" | null
//   - jaInscrito  — true se há uma inscrição registrada (status != null)
//
// Usado por: Hero (troca CTA), Header (esconde CTA), InscricaoGate (bloqueia
// o wizard). Usuário não-autenticado → jaInscrito sempre false.
// ============================================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export type InscricaoStatusValue =
  | "Pendente"
  | "Aprovado"
  | "Reprovado"
  | null;

type InscricaoStatusState = {
  loading: boolean;
  error: boolean;
  status: InscricaoStatusValue;
  jaInscrito: boolean;
};

// Estado + `markInscrito`: chamado pelo wizard logo após um envio
// bem-sucedido. Marca o usuário como inscrito SEM esperar um novo fetch — já
// temos a verdade (ele acabou de enviar). Mantém Hero, Header e InscricaoGate
// em sincronia na mesma sessão, sem reload.
type InscricaoStatusContextValue = InscricaoStatusState & {
  markInscrito: () => void;
};

const Ctx = createContext<InscricaoStatusContextValue>({
  loading: true,
  error: false,
  status: null,
  jaInscrito: false,
  markInscrito: () => {},
});

export function useInscricaoStatus(): InscricaoStatusContextValue {
  return useContext(Ctx);
}

function normalizeStatus(raw: string | null): InscricaoStatusValue {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v.startsWith("aprovad")) return "Aprovado";
  if (v.startsWith("reprovad")) return "Reprovado";
  if (v.startsWith("pendent")) return "Pendente";
  return null;
}

export default function InscricaoStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status: authStatus } = useSession();
  // Deslogado já no 1º render (a sessão vem pré-resolvida do servidor, ver
  // app/layout.tsx) → não há inscrição pra consultar; começa resolvido pra o
  // CTA não piscar "Carregando…". Logado/indefinido → loading até a consulta.
  const [state, setState] = useState<InscricaoStatusState>(() => ({
    loading: authStatus !== "unauthenticated",
    error: false,
    status: null,
    jaInscrito: false,
  }));

  useEffect(() => {
    if (authStatus === "loading") return;
    // Sem sessão: não há como saber/consultar — trata como não inscrito.
    if (authStatus !== "authenticated") {
      setState({ loading: false, error: false, status: null, jaInscrito: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetch("/api/inscricao/status", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; status?: string | null } | null) => {
        if (cancelled) return;
        if (!data || !data.ok) {
          setState({ loading: false, error: true, status: null, jaInscrito: false });
          return;
        }
        const st = normalizeStatus(data.status ?? null);
        setState({
          loading: false,
          error: false,
          status: st,
          jaInscrito: st !== null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ loading: false, error: true, status: null, jaInscrito: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Chamado pelo Inscricao.tsx após um envio bem-sucedido.
  const markInscrito = useCallback(() => {
    setState({
      loading: false,
      error: false,
      status: "Pendente",
      jaInscrito: true,
    });
  }, []);

  const value = useMemo<InscricaoStatusContextValue>(
    () => ({ ...state, markInscrito }),
    [state, markInscrito]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
