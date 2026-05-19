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
import { signOut, useSession } from "next-auth/react";
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

  if (authStatus !== "authenticated" || !session?.user?.email) return null;

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
          className="absolute right-0 mt-2 w-72 z-[70] rounded-xl bg-sol-bgDeep ring-1 ring-white/10 shadow-[0_1.5rem_3.5rem_-0.75rem_rgba(0,0,0,0.55),0_0_3rem_-0.5rem_rgba(255,165,48,0.35)] overflow-hidden normal-case tracking-normal font-normal"
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
