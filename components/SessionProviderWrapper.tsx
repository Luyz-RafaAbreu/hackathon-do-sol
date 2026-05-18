"use client";
// Wrapper client-side do SessionProvider do NextAuth. O Layout (server
// component) não pode importar SessionProvider direto, então delegamos
// pra esse client wrapper.
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
