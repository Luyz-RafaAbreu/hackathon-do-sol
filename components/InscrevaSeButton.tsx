"use client";
// Wrapper de link "Inscreva-se" — checa sessão client-side antes de
// navegar. Sem sessão, intercepta o click e abre o modal de login em
// vez de ir pra /inscricao. Com sessão, é um <Link> normal.
//
// Substitui os <a href="/inscricao"> espalhados pelo site (Header desktop,
// Header mobile, Hero, etc.) sem mudar a aparência — passa className e
// children intactos.
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useSignInModal } from "./SignInModalProvider";

export default function InscrevaSeButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  // Hook opcional pra chamadores que precisam executar lógica adicional no
  // click (ex: fechar menu mobile).
  onClick?: () => void;
}) {
  const { status } = useSession();
  const { open } = useSignInModal();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (status !== "authenticated") {
      e.preventDefault();
      open();
    }
  };

  return (
    <Link href="/inscricao" className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
