import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // breakpoint específico para telas curtas (ex: 720p = 1280x720)
        "h-short": { raw: "(max-height: 800px)" },
      },
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
        // customizados
        neon: "0 0 2.5rem rgba(124, 58, 237, 0.55), 0 0 5rem rgba(255, 140, 0, 0.2)",
        glow: "0 0 1.5rem rgba(255, 140, 0, 0.65)",
        glowStrong: "0 0 3.75rem rgba(255, 140, 0, 0.85), 0 0 7.5rem rgba(232, 121, 249, 0.35)",
        // sobrescreve os defaults do Tailwind (que vêm em px) para rem — escala com a base em 4K
        sm: "0 0.0625rem 0.125rem 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 0.0625rem 0.1875rem 0 rgb(0 0 0 / 0.1), 0 0.0625rem 0.125rem -0.0625rem rgb(0 0 0 / 0.1)",
        md: "0 0.25rem 0.375rem -0.0625rem rgb(0 0 0 / 0.1), 0 0.125rem 0.25rem -0.125rem rgb(0 0 0 / 0.1)",
        lg: "0 0.625rem 0.9375rem -0.1875rem rgb(0 0 0 / 0.1), 0 0.25rem 0.375rem -0.25rem rgb(0 0 0 / 0.1)",
        xl: "0 1.25rem 1.5625rem -0.3125rem rgb(0 0 0 / 0.1), 0 0.5rem 0.625rem -0.375rem rgb(0 0 0 / 0.1)",
        "2xl": "0 1.5625rem 3.125rem -0.75rem rgb(0 0 0 / 0.25)",
        inner: "inset 0 0.125rem 0.25rem 0 rgb(0 0 0 / 0.05)",
      },
      blur: {
        // sobrescreve defaults (px) para rem — escala em telas grandes
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "2.5rem",
        "3xl": "4rem",
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
        "sun-entry": "sunEntry 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-0.875rem)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(1.5rem)" },
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
        sunEntry: {
          "0%": {
            opacity: "0",
            transform: "scale(0.4) rotate(-90deg)",
          },
          "70%": {
            transform: "scale(1.08) rotate(8deg)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1) rotate(0deg)",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
