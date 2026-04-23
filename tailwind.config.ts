import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sol: {
          bg: "#1a0b3d",
          bgDeep: "#0f0624",
          purple: "#4c1d95",
          purpleLight: "#7c3aed",
          orange: "#ff8c00",
          yellow: "#ffc830",
          pink: "#e879f9",
          teal: "#14b8a6",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 40px rgba(124, 58, 237, 0.55), 0 0 80px rgba(255, 140, 0, 0.2)",
        glow: "0 0 24px rgba(255, 140, 0, 0.65)",
        glowStrong: "0 0 60px rgba(255, 140, 0, 0.85), 0 0 120px rgba(232, 121, 249, 0.35)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(circle at 80% 60%, rgba(232,121,249,0.22), transparent 55%), radial-gradient(circle at 10% 80%, rgba(255,140,0,0.18), transparent 55%)",
        "conic-rainbow":
          "conic-gradient(from 0deg, #ff8c00, #e879f9, #7c3aed, #14b8a6, #ffc830, #ff8c00)",
      },
      animation: {
        "float-slow": "float 8s ease-in-out infinite",
        "float-delayed": "float 8s ease-in-out 2s infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "fade-up": "fadeUp 0.8s ease-out both",
        "spin-slow": "spin 18s linear infinite",
        "spin-reverse": "spin 24s linear infinite reverse",
        "shimmer": "shimmer 2.5s linear infinite",
        "marquee": "marquee 30s linear infinite",
        "orbit": "orbit 20s linear infinite",
        "tilt": "tilt 10s ease-in-out infinite",
        "gradient-x": "gradientX 6s ease infinite",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        orbit: {
          "0%": {
            transform:
              "rotate(0deg) translateX(var(--orbit-r, 120px)) rotate(0deg)",
          },
          "100%": {
            transform:
              "rotate(360deg) translateX(var(--orbit-r, 120px)) rotate(-360deg)",
          },
        },
        tilt: {
          "0%,100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
        gradientX: {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
