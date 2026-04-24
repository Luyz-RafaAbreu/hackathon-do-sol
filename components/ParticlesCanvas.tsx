"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;       // velocidade induzida (ex: repulsão do mouse) — sofre fricção
  vy: number;
  driftX: number;   // deriva natural persistente — não sofre fricção
  driftY: number;
  r: number;
  color: string;
  baseAlpha: number;
};

const COLORS = [
  "255, 140, 0",   // orange
  "232, 121, 249", // pink
  "20, 184, 166",  // teal
  "255, 200, 48",  // yellow
  "255, 255, 255", // white
];

export default function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const spawn = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      driftX: (Math.random() - 0.5) * 0.35,
      driftY: (Math.random() - 0.5) * 0.35,
      r: 0.8 + Math.random() * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      baseAlpha: 0.35 + Math.random() * 0.35,
    });

    const applyResize = () => {
      const prevWidth = width;
      const prevHeight = height;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // reescala posições existentes proporcionalmente — evita acumulação
      // de partículas na antiga borda quando a janela é expandida
      if (prevWidth > 0 && prevHeight > 0) {
        const sx = width / prevWidth;
        const sy = height / prevHeight;
        if (sx !== 1 || sy !== 1) {
          for (let i = 0; i < particles.length; i++) {
            particles[i].x *= sx;
            particles[i].y *= sy;
          }
        }
      }

      // target count adapta ao viewport, capado pra nunca poluir
      const area = width * height;
      const target = Math.round(
        Math.min(110, Math.max(50, area / 20000))
      );
      if (particles.length < target) {
        for (let i = particles.length; i < target; i++) particles.push(spawn());
      } else if (particles.length > target) {
        particles.length = target;
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resize = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        applyResize();
      }, 80);
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      mouse.active = true;
    };

    const REPEL_RADIUS = 120;
    const LINK_RADIUS = 110;
    const CURSOR_LINK = 170;

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const tick = (now?: number) => {
      const t = now ?? performance.now();
      const dt = Math.min(32, t - last) / 16.67; // 60fps = 1.0
      last = t;

      ctx.clearRect(0, 0, width, height);

      // update
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < REPEL_RADIUS * REPEL_RADIUS && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const force = (1 - dist / REPEL_RADIUS) * 0.8;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.96;
        p.vy *= 0.96;
        const speed = Math.hypot(p.vx, p.vy);
        const maxSpeed = 1.6;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        // deriva natural muda lentamente — dá sensação de flutuar no espaço
        p.driftX += (Math.random() - 0.5) * 0.004;
        p.driftY += (Math.random() - 0.5) * 0.004;
        if (p.driftX > 0.5) p.driftX = 0.5;
        else if (p.driftX < -0.5) p.driftX = -0.5;
        if (p.driftY > 0.5) p.driftY = 0.5;
        else if (p.driftY < -0.5) p.driftY = -0.5;

        p.x += (p.vx + p.driftX) * dt;
        p.y += (p.vy + p.driftY) * dt;

        // mantém partículas dentro da viewport — reflete ao tocar a borda
        if (p.x < 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx);
          p.driftX = Math.abs(p.driftX);
        } else if (p.x > width) {
          p.x = width;
          p.vx = -Math.abs(p.vx);
          p.driftX = -Math.abs(p.driftX);
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy);
          p.driftY = Math.abs(p.driftY);
        } else if (p.y > height) {
          p.y = height;
          p.vy = -Math.abs(p.vy);
          p.driftY = -Math.abs(p.driftY);
        }
      }

      // linhas entre partículas próximas
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < LINK_RADIUS * LINK_RADIUS) {
            const dist = Math.sqrt(dist2);
            const alpha = (1 - dist / LINK_RADIUS) * 0.14;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // linhas do cursor — ligação com glow aditivo e pulso sutil
      if (mouse.active) {
        ctx.save();
        // "lighter" = blending aditivo: sobreposições somam luminosidade
        ctx.globalCompositeOperation = "lighter";

        // pulso leve na intensidade geral (respiração da ligação)
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.006);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < CURSOR_LINK * CURSOR_LINK) {
            const dist = Math.sqrt(dist2);
            // 0..1 — mais perto do cursor = mais intenso
            const proximity = 1 - dist / CURSOR_LINK;
            const alpha = proximity * pulse;

            // camada 0: halo externo — glow bem difuso e largo
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.035})`;
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            // camada 1: glow intermediário
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.09})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            // camada 2: linha nítida branca (núcleo)
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            // halo externo ao redor da partícula — glow expansivo
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.04})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5 + proximity * 6, 0, Math.PI * 2);
            ctx.fill();

            // halo médio ao redor da partícula
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.09})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5 + proximity * 3.5, 0, Math.PI * 2);
            ctx.fill();

            // ponto luminoso branco na partícula — endpoint (núcleo)
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 0.8 + proximity * 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // partículas
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = `rgba(${p.color}, ${p.baseAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${p.color}, ${p.baseAlpha * 0.12})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (visible) raf = requestAnimationFrame(tick);
    };

    applyResize();
    raf = requestAnimationFrame(tick);

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
