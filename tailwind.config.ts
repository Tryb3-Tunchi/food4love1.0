import type { Config } from 'tailwindcss'
import { colors, radii, shadows, spacing } from './src/design/tokens'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ...colors,
        primary: colors.pepper,
        accent: colors.pepper,
        'accent-hover': colors.tomato,
        'accent-light': colors.bgWarm,
        'accent-soft': colors.ivory,
        'surface-muted': colors.warmgray,
        'surface-strong': colors.surfaceStrong,
        bg: colors.bg,
        'bg-soft': colors.bgSoft,
        'bg-warm': colors.bgWarm,
        surface: colors.surface,
        card: colors.surface,
        border: colors.border,
        divider: colors.divider,
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-2xl': [
          '4.5rem',
          { lineHeight: '0.98', letterSpacing: '-0.045em', fontWeight: '800' },
        ],
        'display-xl': [
          '3.5rem',
          { lineHeight: '1.02', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
        'display-lg': [
          '2.75rem',
          { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '800' },
        ],
        'display-md': [
          '2rem',
          { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'display-sm': [
          '1.5rem',
          { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '700' },
        ],
        'body-lg': [
          '1.125rem',
          { lineHeight: '1.6', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        body: [
          '1rem',
          { lineHeight: '1.6', letterSpacing: '-0.005em', fontWeight: '400' },
        ],
        'body-sm': [
          '0.875rem',
          { lineHeight: '1.55', letterSpacing: '-0.003em', fontWeight: '400' },
        ],
        caption: [
          '0.75rem',
          { lineHeight: '1.45', letterSpacing: '0.01em', fontWeight: '500' },
        ],
        'label-lg': [
          '0.8125rem',
          { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '600' },
        ],
        'label-sm': [
          '0.6875rem',
          { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '600' },
        ],
      },
      borderRadius: radii,
      boxShadow: shadows,
      spacing,
      container: {
        center: true,
        padding: '1rem',
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1440px',
        },
      },
      animation: {
        'card-in': 'cardIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        shimmer: 'shimmer 1.8s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'float-gentle': 'floatGentle 8s ease-in-out infinite',
        drift: 'drift 14s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.2s ease-in-out infinite',
        'counter-pop': 'counterPop 0.55s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      backgroundImage: {
        'warm-radial':
          'radial-gradient(circle at top, rgba(255,143,63,0.22), transparent 45%), radial-gradient(circle at 20% 20%, rgba(232,90,42,0.12), transparent 35%), radial-gradient(circle at 80% 30%, rgba(143,203,107,0.08), transparent 30%)',
        'hero-mesh':
          'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,243,230,0.94)), radial-gradient(circle at top right, rgba(255,143,63,0.18), transparent 32%), radial-gradient(circle at bottom left, rgba(232,90,42,0.14), transparent 36%)',
      },
      keyframes: {
        cardIn: {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        floatGentle: {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-12px,0)' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(16px,-10px,0) scale(1.02)' },
          '66%': { transform: 'translate3d(-12px,14px,0) scale(0.98)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(232,90,42,0.25)' },
          '50%': { boxShadow: '0 0 0 10px rgba(232,90,42,0)' },
        },
        counterPop: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.94)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
