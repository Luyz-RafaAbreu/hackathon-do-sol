"use client";
import { useEffect, useState } from "react";

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const height = h.scrollHeight - h.clientHeight;
      setPct(height > 0 ? (scrolled / height) * 100 : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-transparent"
      aria-hidden
    >
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-sol-orange via-sol-pink to-sol-purpleLight transition-transform duration-150"
        style={{ transform: `scaleX(${pct / 100})`, boxShadow: "0 0 0.75rem rgba(255,140,0,0.8)" }}
      />
    </div>
  );
}
