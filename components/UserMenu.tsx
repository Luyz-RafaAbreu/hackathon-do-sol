"use client";
// Menu de conta — avatar do Google + primeiro nome no Header. Click abre
// dropdown com status da inscrição (pendente/aprovado/reprovado) e botão
// de sair.
//
// Status é fetched só na primeira abertura do dropdown (lazy) e cacheado
// pela duração da sessão. Re-fetch ao reabrir não faz pra evitar request
// barato demais — se o admin mudar status, o usuário recarrega a página.
//
// Mobile (variant="mobile"): renderizado dentro do menu hamburger; sem
// dropdown, mostra status + sair direto no card.
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";

type Variant = "desktop" | "mobile";
type InscricaoStatus = "Pendente" | "Aprovado" | "Reprovado" | null;
type StatusFetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; status: InscricaoStatus }
  | { kind: "error" };

export default function UserMenu({ variant = "desktop" }: { variant?: Variant }) {
  const { data: session, status: authStatus } = useSession();
  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [statusState, setStatusState] = useState<StatusFetchState>({ kind: "idle" });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click fora fecha o dropdown
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fetchStatus = useCallback(async () => {
    setStatusState({ kind: "loading" });
    try {
      const res = await fetch("/api/inscricao/status", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setStatusState({ kind: "error" });
        return;
      }
      const data = (await res.json()) as { ok: boolean; status?: string | null };
      if (!data.ok) {
        setStatusState({ kind: "error" });
        return;
      }
      const normalized = normalizeStatus(data.status ?? null);
      setStatusState({ kind: "ready", status: normalized });
    } catch {
      setStatusState({ kind: "error" });
    }
  }, []);

  // Mobile: fetch ao montar (sem dropdown, mostra direto)
  useEffect(() => {
    if (variant !== "mobile") return;
    if (authStatus !== "authenticated") return;
    if (statusState.kind !== "idle") return;
    fetchStatus();
  }, [variant, authStatus, statusState.kind, fetchStatus]);

  // Desktop: fetch na primeira abertura do dropdown
  useEffect(() => {
    if (variant !== "desktop") return;
    if (!open) return;
    if (statusState.kind !== "idle") return;
    fetchStatus();
  }, [variant, open, statusState.kind, fetchStatus]);

  // Deslogado → botão de login destacado (branco + glow, glifo colorido do
  // Google). Durante `loading` também mostra o botão: a maioria dos visitantes
  // está deslogada; havendo sessão, o menu de conta substitui logo em seguida.
  if (authStatus !== "authenticated" || !session?.user?.email) {
    if (variant === "mobile") {
      return (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white text-zinc-900 font-semibold text-[0.95rem] px-4 py-3.5 shadow-lg shadow-black/25 hover:bg-white/95 transition normal-case tracking-normal"
        >
          <GoogleGlyph className="h-5 w-5" />
          Entrar com Google
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="hidden md:inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 font-semibold text-sm pl-3 pr-4 py-2 shadow-[0_0.5rem_1.25rem_-0.375rem_rgba(255,255,255,0.45)] hover:-translate-y-px hover:shadow-[0_0.75rem_1.75rem_-0.375rem_rgba(255,255,255,0.7)] transition-all duration-300 normal-case tracking-normal"
      >
        <GoogleGlyph className="h-4 w-4" />
        Entrar com Google
      </button>
    );
  }

  const email = session.user.email;
  const fullName = session.user.name || email;
  const firstName = fullName.split(" ")[0] || "Conta";
  const image = session.user.image;
  const initial = (fullName[0] ?? "?").toUpperCase();

  if (variant === "mobile") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar
            image={image}
            initial={initial}
            imgFailed={imgFailed}
            setImgFailed={setImgFailed}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 truncate font-medium normal-case tracking-normal">
              {fullName}
            </p>
            <p className="text-xs text-white/55 truncate normal-case tracking-normal font-normal">
              {email}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-[0.625rem] uppercase tracking-[0.22em] font-mono text-white/45 mb-1">
              Status da inscrição
            </p>
            <StatusChip state={statusState} />
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center gap-1.5 flex-shrink-0 text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 transition normal-case tracking-normal font-normal"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
            Sair
          </button>
        </div>
      </div>
    );
  }

  // ─── DESKTOP ───
  return (
    <div ref={containerRef} className="hidden md:block relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.04] transition normal-case tracking-normal font-normal"
      >
        <Avatar
          image={image}
          initial={initial}
          imgFailed={imgFailed}
          setImgFailed={setImgFailed}
          size={28}
        />
        <span className="text-xs text-white/80 max-w-[8rem] truncate">
          {firstName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/55 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <div
          role="menu"
          // Lenis (smooth scroll global) não intercepta a roda aqui, e o
          // scroll não vaza pra página — consistente com os outros dropdowns.
          data-lenis-prevent
          className="absolute right-0 mt-2 w-72 z-[70] rounded-xl bg-sol-bgDeep ring-1 ring-white/10 shadow-[0_1.5rem_3.5rem_-0.75rem_rgba(0,0,0,0.55),0_0_3rem_-0.5rem_rgba(255,165,48,0.35)] overflow-hidden overscroll-contain normal-case tracking-normal font-normal"
        >
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
            <Avatar
              image={image}
              initial={initial}
              imgFailed={imgFailed}
              setImgFailed={setImgFailed}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 truncate font-medium">{fullName}</p>
              <p className="text-[0.6875rem] text-white/55 truncate">{email}</p>
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] font-mono text-white/45 mb-1.5">
              Status da inscrição
            </p>
            <StatusChip state={statusState} />
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full px-4 py-3 flex items-center gap-2 text-sm text-white/75 hover:text-white hover:bg-white/[0.04] border-t border-white/[0.08] transition"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}

function normalizeStatus(raw: string | null): InscricaoStatus {
  if (!raw) return null;
  const v = raw.trim();
  if (v.toLowerCase().startsWith("aprovad")) return "Aprovado";
  if (v.toLowerCase().startsWith("reprovad")) return "Reprovado";
  if (v.toLowerCase().startsWith("pendent")) return "Pendente";
  return null;
}

function StatusChip({ state }: { state: StatusFetchState }) {
  if (state.kind === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-white/55">
        <span className="inline-block h-3 w-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        Carregando…
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-300/85">
        <Dot className="bg-red-400" />
        Erro ao consultar
      </span>
    );
  }
  if (state.kind === "ready") {
    const s = state.status;
    if (s === "Aprovado") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-medium px-2.5 py-1">
          <Dot className="bg-emerald-400" />
          Aprovada
        </span>
      );
    }
    if (s === "Reprovado") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-400/10 border border-red-400/30 text-red-300 text-xs font-medium px-2.5 py-1">
          <Dot className="bg-red-400" />
          Reprovada
        </span>
      );
    }
    if (s === "Pendente") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sol-orange/10 border border-sol-orange/30 text-sol-orange text-xs font-medium px-2.5 py-1">
          <Dot className="bg-sol-orange" />
          Pendente de análise
        </span>
      );
    }
    // null = sem inscrição
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white/55 text-xs px-2.5 py-1">
        <Dot className="bg-white/30" />
        Sem inscrição registrada
      </span>
    );
  }
  return null;
}

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />
  );
}

// Glifo "G" oficial do Google (multicolor). Mantém o login reconhecível à
// primeira vista.
function GoogleGlyph({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} focusable="false">
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
