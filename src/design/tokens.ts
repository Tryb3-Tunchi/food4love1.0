export const colors = {
  pepper: "#E8390E",
  ember: "#F59E0B",
  lime: "#84CC16",
  cream: "#FEF7ED",
  ivory: "#FFF5E8",
  biscuit: "#E9DACD",
  parchment: "#F6EDE2",
  warmgray: "#F5EFE8",
  fog: "#F0EBE3",
  salt: "#FAF5EE",
  char: "#0F0A05",
  smoke: "#1A1008",
  coal: "#2A1F14",
  ink: "#2F241F",
  body: "#6B5E57",
  muted: "#9A8E86",
  ash: "#6B5B4E",
  mist: "#A89B8C",
  surface: "#FFFFFF",
  border: "#E8DED5",
  divider: "#F1E8DF",
  bg: "#FFF9F2",
  bgSoft: "#FFF5E8",
  success: "#4F8A54",
  warning: "#FFD966",
  danger: "#D64545",
} as const;

export const radii = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  full: "9999px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(47,36,31,0.06), 0 8px 24px rgba(47,36,31,0.04)",
  lift: "0 8px 28px rgba(47,36,31,0.08)",
  glow: "0 0 0 1px rgba(232,57,14,0.16), 0 10px 40px rgba(232,57,14,0.18)",
  warm: "0 8px 24px rgba(232,57,14,0.16)",
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  "4xl": "2.5rem",
  "5xl": "3rem",
  "6xl": "4rem",
} as const;

export const fontSizes = {
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
};
