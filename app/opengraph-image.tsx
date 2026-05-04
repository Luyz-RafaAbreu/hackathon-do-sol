import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/event";

export const runtime = "edge";
export const alt = `${EVENT.NAME} — ${EVENT.DATE_RANGE_LONG} — ${EVENT.CITY_STATE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Revalida a cada hora — countdown muda só uma vez por dia, mas damos folga
// pra propagar antes que o cache de redes sociais (que geralmente é horário).
export const revalidate = 3600;

const EVENT_START = EVENT.START_DATE;
const EVENT_END = EVENT.END_DATE;

function getStatus(): { label: string; sub: string } {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now < EVENT_START) {
    const days = Math.ceil((EVENT_START.getTime() - now.getTime()) / dayMs);
    return {
      label: days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`,
      sub: "Inscrições abertas",
    };
  }
  if (now <= EVENT_END) {
    return { label: "Acontecendo agora", sub: "Estamos vivendo isso" };
  }
  return { label: "Edição 2026", sub: "Até a próxima!" };
}

export default async function Image() {
  const { label, sub } = getStatus();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #1a0a3e 0%, #0f0624 60%, #15082d 100%)",
          padding: 80,
          position: "relative",
        }}
      >
        {/* glow blobs — atmosfera de fundo */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(255, 140, 0, 0.28)",
            filter: "blur(90px)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -140,
            width: 460,
            height: 460,
            borderRadius: 9999,
            background: "rgba(232, 121, 249, 0.22)",
            filter: "blur(90px)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 200,
            left: 240,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: "rgba(124, 58, 237, 0.18)",
            filter: "blur(80px)",
            display: "flex",
          }}
        />

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#ff8c00",
            fontSize: 26,
            letterSpacing: 8,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 40,
              height: 3,
              background: "#ff8c00",
              borderRadius: 9999,
            }}
          />
          Hackathon do Sol · 2026
        </div>

        {/* contador grande */}
        <div
          style={{
            display: "flex",
            fontSize: 150,
            fontWeight: 900,
            backgroundImage:
              "linear-gradient(90deg, #ffc830 0%, #ff8c00 50%, #e879f9 100%)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1.05,
            marginTop: 36,
            letterSpacing: -3,
          }}
        >
          {label}
        </div>

        {/* sub */}
        <div
          style={{
            display: "flex",
            fontSize: 38,
            color: "rgba(255, 255, 255, 0.92)",
            marginTop: 28,
            fontWeight: 600,
          }}
        >
          {sub} · {EVENT.DATE_RANGE_SHORT} · {EVENT.LOCATION_SHORT}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginTop: "auto",
            fontSize: 26,
            color: "rgba(255, 255, 255, 0.7)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 9999,
              border: "2px solid rgba(255, 200, 48, 0.45)",
              color: "#ffc830",
              background: "rgba(255, 200, 48, 0.08)",
              fontWeight: 700,
            }}
          >
            {EVENT.PRIZE} em prêmios
          </span>
          <span style={{ display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>{EVENT.SLOTS} vagas</span>
          <span style={{ display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>
            {EVENT.SITE_URL.replace(/^https?:\/\//, "")}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
