import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Primary palette
        cream: "#FFF9F2",
        ivory: "#FFF5E8",
        accent: "#E87428",
        "accent-hover": "#D9651C",
        "accent-light": "#FFEEE6",
        success: "#4F8A54",
        warning: "#FFD966",
        danger: "#D64545",

        // Text
        ink: "#2F241F",
        secondary: "#6B5E57",
        muted: "#9A8E86",

        // Borders
        border: "#E8DED5",
        divider: "#F1E8DF",

        // Dark mode
        "dark-bg": "#2B211C",
        "dark-surface": "#3A2D27",
        "dark-border": "#56453C",
        "dark-text": "#F7F2ED",

        // Keep for backward compat
        pepper: "#E87428",
        ember: "#F59E0B",
        "naija-green": "#4F8A54",
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
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(47,36,31,0.06), 0 4px 16px rgba(47,36,31,0.06)",
        "card-hover":
          "0 4px 12px rgba(47,36,31,0.10), 0 16px 40px rgba(47,36,31,0.08)",
        lift: "0 2px 8px rgba(47,36,31,0.08), 0 8px 24px rgba(47,36,31,0.06)",
        accent: "0 4px 20px rgba(232,116,40,0.25)",
        "accent-lg": "0 8px 32px rgba(232,116,40,0.30)",
        focus: "0 0 0 3px rgba(232,116,40,0.20)",
      },
      animation: {
        "card-in": "cardIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-up": "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 1.8s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
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
      },
    },
  },
  plugins: [],
};

export default config;
