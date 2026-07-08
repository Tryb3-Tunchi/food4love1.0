import type { Config } from "tailwindcss";
import { colors, radii, shadows, spacing } from "./src/design/tokens";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ...colors,
        primary: colors.pepper,
        accent: colors.pepper,
        "accent-hover": "#D4330C",
        "accent-light": colors.ivory,
        "accent-soft": colors.parchment,
        bg: colors.bg,
        "bg-soft": colors.bgSoft,
        surface: colors.surface,
        card: colors.surface,
        border: colors.border,
        divider: colors.divider,
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        sans: ["Plus Jakarta Sans Variable", "Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-xl": [
          "3.5rem",
          { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
        "display-lg": [
          "2.75rem",
          { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "700" },
        ],
        "display-md": [
          "2rem",
          { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "display-sm": [
          "1.5rem",
          { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" },
        ],
        "label-lg": [
          "0.8125rem",
          { lineHeight: "1.4", letterSpacing: "0.05em", fontWeight: "600" },
        ],
        "label-sm": [
          "0.6875rem",
          { lineHeight: "1.4", letterSpacing: "0.05em", fontWeight: "600" },
        ],
      },
      borderRadius: radii,
      boxShadow: shadows,
      spacing,
      container: {
        center: true,
        padding: "1rem",
        screens: {
          sm: "640px",
          md: "768px",
          lg: "1024px",
          xl: "1280px",
          "2xl": "1440px",
        },
      },
      animation: {
        "card-in": "cardIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-up": "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 1.8s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        cardIn: {
          from: { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
