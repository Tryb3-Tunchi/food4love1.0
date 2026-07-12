export const colors = {
  pepper: '#E85A2A',
  tomato: '#D9482A',
  jollof: '#FF8F3F',
  ember: '#F3B33D',
  lime: '#8FCB6B',
  herb: '#4B8B57',
  leaf: '#6C9B63',
  meadow: '#2F6A43',
  sage: '#DDEBD4',
  mint: '#EFF7EA',
  cream: '#FFFAF4',
  ivory: '#FFF3E6',
  biscuit: '#ECD9C6',
  parchment: '#F5E9DD',
  warmgray: '#F6EEE7',
  fog: '#F4E8DC',
  blush: '#F9DDD3',
  butter: '#F6E3A6',
  lilac: '#E9DDF6',
  sky: '#DEEAF7',
  salt: '#FFFDFC',
  clay: '#C78E6B',
  cocoa: '#5B392D',
  char: '#140E0A',
  smoke: '#241814',
  coal: '#36251E',
  ink: '#2F211B',
  body: '#6E5A52',
  muted: '#9A857B',
  ash: '#7B665D',
  mist: '#B79F92',
  surface: '#FFFEFC',
  surfaceStrong: '#FFF7EE',
  border: '#E9D6C5',
  divider: '#F3E6DA',
  bg: '#FFFAF4',
  bgSoft: '#FFF3E6',
  bgWarm: '#FFEDE2',
  success: '#3F865B',
  warning: '#D69A1C',
  danger: '#CF5046',
  info: '#3A7EA8',
} as const

export const radii = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '2.5rem',
  full: '9999px',
} as const

export const shadows = {
  card: '0 1px 2px rgba(47,33,27,0.05), 0 12px 30px rgba(91,57,45,0.06)',
  lift: '0 18px 42px rgba(91,57,45,0.12)',
  float: '0 22px 55px rgba(91,57,45,0.14)',
  glow: '0 0 0 1px rgba(232,90,42,0.16), 0 14px 40px rgba(232,90,42,0.18)',
  warm: '0 16px 36px rgba(232,90,42,0.18)',
  innerWarm:
    'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(232,90,42,0.08)',
} as const

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '2.5rem',
  '5xl': '3rem',
  '6xl': '4rem',
  '7xl': '5rem',
} as const

export const fontSizes = {
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
}
