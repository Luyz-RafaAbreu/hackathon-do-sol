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

export type InscricaoKind = "equipe" | "individual" | null;

type InscricaoStatusState = {
  loading: boolean;
  error: boolean;
  status: InscricaoStatusValue;
  jaInscrito: boolean;
  // Modalidade da inscrição encontrada (ou null se status null). Usado pelo
  // Gate pra texto adaptativo do JaInscritoModal.
  kind: InscricaoKind;
};

// Estado + `markInscrito(kind)`: chamado pelo wizard logo após um envio
// bem-sucedido. Marca o usuário como inscrito SEM esperar um novo fetch — já
// temos a verdade (ele acabou de enviar). Mantém Hero, Header e InscricaoGate
// em sincronia na mesma sessão, sem reload.
type InscricaoStatusContextValue = InscricaoStatusState & {
  markInscrito: (kind: "equipe" | "individual") => void;
};

const Ctx = createContext<InscricaoStatusContextValue>({
  loading: true,
  error: false,
  status: null,
  jaInscrito: false,
  kind: null,
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
    kind: null,
  }));

  useEffect(() => {
    if (authStatus === "loading") return;
    // Sem sessão: não há como saber/consultar — trata como não inscrito.
    if (authStatus !== "authenticated") {
      setState({ loading: false, error: false, status: null, jaInscrito: false, kind: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetch("/api/inscricao/status", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          ok?: boolean;
          status?: string | null;
          kind?: "equipe" | "individual" | null;
        } | null) => {
          if (cancelled) return;
          if (!data || !data.ok) {
            setState({ loading: false, error: true, status: null, jaInscrito: false, kind: null });
            return;
          }
          const st = normalizeStatus(data.status ?? null);
          setState({
            loading: false,
            error: false,
            status: st,
            jaInscrito: st !== null,
            kind: st !== null ? (data.kind ?? null) : null,
          });
        }
      )
      .catch(() => {
        if (!cancelled) {
          setState({ loading: false, error: true, status: null, jaInscrito: false, kind: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Chamado pelo wizard (equipe ou individual) após envio bem-sucedido.
  // Recebe o modo pra Gate poder mostrar texto adaptativo do JaInscritoModal.
  const markInscrito = useCallback((kind: "equipe" | "individual") => {
    setState({
      loading: false,
      error: false,
      status: "Pendente",
      jaInscrito: true,
      kind,
    });
  }, []);

  const value = useMemo<InscricaoStatusContextValue>(
    () => ({ ...state, markInscrito }),
    [state, markInscrito]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
