"use client";
import { useEffect, useRef, ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
};

// Um único IntersectionObserver compartilhado por toda a página em vez de
// 1 por Reveal. ~30 instâncias de Reveal viram 1 observer só.
//
// Cada elemento observado guarda sua config (delay) num WeakMap; quando o
// observer dispara, ele consulta o map pelo elemento. Cleanup do useEffect
// também cancela o setTimeout — fechando de quebra o vazamento (item #10
// da auditoria) onde o cleanup do setTimeout nunca rodava.
type RevealConfig = { delay: number; timeoutId: number | null };
const REVEAL_CONFIG = new WeakMap<Element, RevealConfig>();

let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const cfg = REVEAL_CONFIG.get(e.target);
        if (!cfg) continue;
        cfg.timeoutId = window.setTimeout(() => {
          e.target.classList.add("reveal-in");
        }, cfg.delay);
        sharedObserver!.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
  );
  return sharedObserver;
}

export default function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getObserver();
    const config: RevealConfig = { delay, timeoutId: null };
    REVEAL_CONFIG.set(el, config);
    io.observe(el);
    return () => {
      io.unobserve(el);
      if (config.timeoutId !== null) clearTimeout(config.timeoutId);
      REVEAL_CONFIG.delete(el);
    };
  }, [delay]);

  const Tag = as as any;
  return (
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
