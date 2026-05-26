"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, Users, X } from "lucide-react";
import MagneticButton from "./MagneticButton";

const WHATSAPP_CHAT_URL =
  "https://wa.me/5584999808888?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20Hackathon%20do%20Sol.";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/FEUrNP0RfgFExmmOcQe2uv";

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  const [atFooter, setAtFooter] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setShowTop(window.scrollY > 500);
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

  // Observa o rodapé: quando ele entra na tela, `atFooter` vira true.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(([entry]) =>
      setAtFooter(entry.isIntersecting)
    );
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  // Largura de mobile (< md = 768px). No desktop sobra largura e os botões
  // não encostam no texto do rodapé, então lá eles ficam sempre visíveis.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Fecha o speed dial com Esc ou click fora do container.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  // Só some quando é mobile E o rodapé está visível — ali os botões ficariam
  // sobre o texto do rodapé.
  const hidden = atFooter && isNarrow;
  // Esconde "voltar ao topo" enquanto o speed dial está aberto pra não
  // sobrepor visualmente os mini-FABs.
  const showTopBtn = showTop && !menuOpen;

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
        hidden ? "opacity-0 pointer-events-none" : ""
      }`}
    >
      {/* Back to top — mr-1 alinha o centro deste botão (w-12 = 48px) com o
          centro do botão principal (w-14 = 56px), que está colado à direita. */}
      <MagneticButton
        strength={10}
        radius={60}
        className={`mr-1 transition-all duration-500 ${
          showTopBtn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="group relative w-12 h-12 rounded-full bg-white/10 border border-white/15 backdrop-blur-lg text-white transition-colors duration-500 hover:bg-sol-orange hover:text-black"
        >
          <ArrowUp className="w-5 h-5 mx-auto" strokeWidth={2.5} />
        </button>
      </MagneticButton>

      {/* Wrapper relativo: o speed dial é posicionado absolute em relação a
          ele, logo acima do botão principal. Tirar o menu do fluxo flex evita
          que ele reserve espaço quando fechado (o que empurraria o "Voltar
          ao topo" pra cima). */}
      <div className="relative">
        {/* Speed dial — opções do WhatsApp. Sempre renderizado pra animar com
            opacity/translate; pointer-events e tabindex desligam interação
            quando o menu está fechado. */}
        <div
          id="whatsapp-speed-dial"
          role="menu"
          aria-hidden={!menuOpen}
          className={`absolute bottom-full right-0 mb-3 flex flex-col items-end gap-3 transition-all duration-300 ${
            menuOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {/* mr-1 (4px) alinha o centro do mini-FAB (w-12 = 48px) com o
              centro do botão principal (w-14 = 56px), que está colado à
              direita. */}
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            tabIndex={menuOpen ? 0 : -1}
            className="group flex items-center gap-3 mr-1"
            onClick={() => setMenuOpen(false)}
          >
            <span className="rounded-full bg-zinc-900/85 border border-white/10 backdrop-blur px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shadow-lg">
              Entrar no grupo
            </span>
            <span className="w-12 h-12 rounded-full bg-[#25D366] text-white shadow-[0_0.5rem_1.5rem_-0.5rem_rgba(37,211,102,0.8)] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Users className="w-5 h-5" strokeWidth={2.2} />
            </span>
          </a>

          <a
            href={WHATSAPP_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            tabIndex={menuOpen ? 0 : -1}
            className="group flex items-center gap-3 mr-1"
            onClick={() => setMenuOpen(false)}
          >
            <span className="rounded-full bg-zinc-900/85 border border-white/10 backdrop-blur px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shadow-lg">
              Falar conosco
            </span>
            <span className="w-12 h-12 rounded-full bg-[#25D366] text-white shadow-[0_0.5rem_1.5rem_-0.5rem_rgba(37,211,102,0.8)] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
            </span>
          </a>
        </div>

        {/* Botão principal — toggla o speed dial */}
        <MagneticButton strength={10} radius={70}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Fechar opções de contato" : "Abrir opções de contato no WhatsApp"}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls="whatsapp-speed-dial"
          className="group relative w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_0.625rem_1.875rem_-0.625rem_rgba(37,211,102,0.8)] transition-all duration-300 flex items-center justify-center"
        >
          {/* Anel pulsante chama atenção quando fechado; some quando aberto.
              pointer-events-none é crítico: o animate-ping renderiza em
              scale(2), o que estenderia a hitbox do botão pra ~112x112 e
              roubaria cliques do "Voltar ao topo" acima. */}
          {!menuOpen && (
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40 pointer-events-none" />
          )}
          {menuOpen ? (
            <X className="w-6 h-6 relative" strokeWidth={2.5} />
          ) : (
            <svg
              className="w-7 h-7 relative"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M20.52 3.48A11.95 11.95 0 0012.02 0C5.4 0 .04 5.36.04 12c0 2.11.55 4.16 1.6 5.98L0 24l6.17-1.62A11.93 11.93 0 0012.02 24c6.61 0 11.98-5.36 11.98-12 0-3.2-1.25-6.2-3.48-8.52zM12.02 21.8a9.8 9.8 0 01-5-1.37l-.36-.21-3.67.96.98-3.58-.23-.37A9.78 9.78 0 012.24 12c0-5.4 4.39-9.78 9.78-9.78 2.61 0 5.07 1.02 6.92 2.86a9.72 9.72 0 012.86 6.92c0 5.39-4.39 9.78-9.78 9.78zm5.36-7.32c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.65.14-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.87-.77-1.46-1.73-1.63-2.02-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.14-.17.19-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49h-.55c-.19 0-.5.07-.76.37-.26.29-1 1-1 2.43s1.03 2.82 1.17 3.01c.15.2 2.03 3.1 4.92 4.35.69.3 1.22.48 1.64.61.69.22 1.32.19 1.81.12.55-.08 1.73-.71 1.97-1.39.24-.68.24-1.26.17-1.39-.07-.12-.26-.19-.55-.34z" />
            </svg>
          )}
          </button>
        </MagneticButton>
      </div>
    </div>
  );
}
