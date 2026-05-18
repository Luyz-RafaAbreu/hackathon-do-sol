"use client";
// Indicador de login no Header — avatar do Google + email truncado + botão sair.
// Renderiza nada quando a sessão ainda tá carregando ou o usuário não está
// logado. Posicionado entre os links de navegação e o botão "Inscreva-se".
//
// Sem dropdown: como o app só tem "ver email" e "sair" como ações de conta,
// expor os dois inline é mais rápido que abrir menu.
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

type Variant = "desktop" | "mobile";

export default function UserMenu({ variant = "desktop" }: { variant?: Variant }) {
  const { data: session, status } = useSession();
  const [imgFailed, setImgFailed] = useState(false);

  if (status !== "authenticated" || !session?.user?.email) return null;

  const email = session.user.email;
  const image = session.user.image;
  const initial = email[0]?.toUpperCase() ?? "?";

  if (variant === "mobile") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <Avatar image={image} initial={initial} imgFailed={imgFailed} setImgFailed={setImgFailed} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[0.625rem] uppercase tracking-[0.22em] font-mono text-white/45">
            Logado como
          </p>
          <p className="text-sm text-white/90 truncate">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex-shrink-0 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 transition"
        >
          Sair
        </button>
      </div>
    );
  }

  // desktop
  return (
    <div className="hidden md:flex items-center gap-2 pr-1">
      <Avatar image={image} initial={initial} imgFailed={imgFailed} setImgFailed={setImgFailed} size={28} />
      <span
        className="text-xs text-white/65 max-w-[10rem] truncate font-normal normal-case tracking-normal"
        title={email}
      >
        {email}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-xs text-white/45 hover:text-white transition px-2 py-1 rounded font-normal normal-case tracking-normal"
        title="Sair"
      >
        Sair
      </button>
    </div>
  );
}

function Avatar({
  image,
  initial,
  imgFailed,
  setImgFailed,
  size,
}: {
  image?: string | null;
  initial: string;
  imgFailed: boolean;
  setImgFailed: (v: boolean) => void;
  size: number;
}) {
  if (image && !imgFailed) {
    // <img> nativo (não next/image) porque o domínio do Google precisaria
    // estar em next.config.js → mais config pra um avatar de 28px. CSP já
    // libera lh3.googleusercontent.com.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full flex-shrink-0 border border-white/15"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full flex-shrink-0 inline-flex items-center justify-center bg-sol-orange/20 border border-sol-orange/40 text-sol-orange font-medium"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
