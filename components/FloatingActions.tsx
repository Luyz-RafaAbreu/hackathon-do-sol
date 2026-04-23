"use client";
import { useEffect, useState } from "react";

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Voltar ao topo"
        className={`group relative w-12 h-12 rounded-full bg-white/10 border border-white/15 backdrop-blur-lg text-white transition-all duration-500 hover:bg-sol-orange hover:text-black hover:scale-110 ${
          showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <svg
          className="w-5 h-5 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>

      {/* WhatsApp / Contato — PLACEHOLDER: trocar número em href quando disponível */}
      <a
        href="https://wa.me/5584000000000?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20Hackathon%20do%20Sol."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
        className="group relative w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-10px_rgba(37,211,102,0.8)] hover:scale-110 transition-all duration-300 flex items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40" />
        <svg
          className="w-7 h-7 relative"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M20.52 3.48A11.95 11.95 0 0012.02 0C5.4 0 .04 5.36.04 12c0 2.11.55 4.16 1.6 5.98L0 24l6.17-1.62A11.93 11.93 0 0012.02 24c6.61 0 11.98-5.36 11.98-12 0-3.2-1.25-6.2-3.48-8.52zM12.02 21.8a9.8 9.8 0 01-5-1.37l-.36-.21-3.67.96.98-3.58-.23-.37A9.78 9.78 0 012.24 12c0-5.4 4.39-9.78 9.78-9.78 2.61 0 5.07 1.02 6.92 2.86a9.72 9.72 0 012.86 6.92c0 5.39-4.39 9.78-9.78 9.78zm5.36-7.32c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.65.14-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.87-.77-1.46-1.73-1.63-2.02-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.14-.17.19-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49h-.55c-.19 0-.5.07-.76.37-.26.29-1 1-1 2.43s1.03 2.82 1.17 3.01c.15.2 2.03 3.1 4.92 4.35.69.3 1.22.48 1.64.61.69.22 1.32.19 1.81.12.55-.08 1.73-.71 1.97-1.39.24-.68.24-1.26.17-1.39-.07-.12-.26-.19-.55-.34z" />
        </svg>
      </a>
    </div>
  );
}
