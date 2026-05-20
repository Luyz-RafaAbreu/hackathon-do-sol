"use client";
// Wrapper client-side do SessionProvider do NextAuth. O Layout (server
// component) não pode importar SessionProvider direto, então delegamos
// pra esse client wrapper.
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

// A sessão vem pré-resolvida do servidor (app/layout.tsx) — assim o
// `useSession()` no client já sabe o estado de login no 1º render, sem o
// flash de status "loading".
export default function SessionProviderWrapper({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
