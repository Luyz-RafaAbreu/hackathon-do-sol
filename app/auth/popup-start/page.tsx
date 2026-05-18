"use client";
// Página dentro do popup OAuth. Roda no mount, dispara o signIn do NextAuth
// (que redireciona o popup pro Google). Após autorizar, o popup volta pra
// /auth/popup-callback, que fecha sozinho.
//
// Não tem UI bonita de propósito — fica visível por <1s antes do redirect
// pro Google acontecer. Texto serve só de fallback caso algo trave.
import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function PopupStartPage() {
  useEffect(() => {
    signIn("google", { callbackUrl: "/auth/popup-callback" });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a0b3d] text-white">
      <div className="text-center">
        <div className="inline-block h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin mb-3" />
        <p className="text-sm text-white/70">Conectando com o Google…</p>
      </div>
    </div>
  );
}
