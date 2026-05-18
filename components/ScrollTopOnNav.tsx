"use client";
// ============================================================================
// components/ScrollTopOnNav.tsx
// ----------------------------------------------------------------------------
// Garante que toda navegação caia no topo da página:
//
//   1. `history.scrollRestoration = "manual"` desliga a restauração
//      automática do navegador (que tenta lembrar onde a página anterior
//      estava em navegações full-page). Por padrão, browsers fazem "scroll
//      restoration" no back/forward — útil pra UX de navegador, ruim quando
//      a gente faz window.location.href pra outra rota e o navegador
//      tenta restaurar uma posição que não faz sentido no novo contexto.
//
//   2. usePathname() dispara quando a rota muda (incluindo navegação via
//      <Link>). Em toda mudança, scroll pro topo. Hash anchors (`#sobre`)
//      NÃO mudam pathname — continuam funcionando normalmente (Lenis cuida).
//
// Compatibilidade com Lenis (smooth scroll): se Lenis estiver instanciado,
// usa o método dele pra scroll instantâneo; senão, cai pro window.scrollTo.
// ============================================================================
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type LenisLike = { scrollTo: (target: number, opts?: { immediate?: boolean }) => void };

export default function ScrollTopOnNav() {
  const pathname = usePathname();

  // Roda só uma vez — desliga restauração de scroll do navegador
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Scroll pro topo a cada mudança de rota.
  // Reforça múltiplas vezes nos primeiros 500ms pra sobrepor outros effects
  // que possam tentar scrollar (autoFocus, scrollIntoView em filhos, etc.).
  // Sem esse "spam", scrolls competidores ganhavam o lance final.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollTop = () => {
      const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
      if (lenis) {
        lenis.scrollTo(0, { immediate: true });
      } else {
        window.scrollTo(0, 0);
      }
    };
    scrollTop();
    const ids = [50, 150, 350].map((d) => window.setTimeout(scrollTop, d));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [pathname]);

  return null;
}
