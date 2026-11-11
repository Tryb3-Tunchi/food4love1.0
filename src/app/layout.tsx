import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    default: 'Food4Love — Discover Home Chefs Near You',
    template: '%s · Food4Love',
  },
  description:
    'Match with home chefs in your city. Real food, real people. Lagos, Abuja, Port Harcourt.',
  keywords: [
    'home chef',
    'food discovery',
    'Nigerian food',
    'home cooking',
    'local chef',
  ],
  openGraph: {
    type: 'website',
    title: 'Food4Love',
    description: 'Discover home chefs near you',
    siteName: 'Food4Love',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Food4Love',
    statusBarStyle: 'default',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#4b8b57',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Android Chrome: shrink the page when the keyboard opens, so the message box
  // stays visible instead of being covered (100dvh then follows the keyboard).
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <script src="https://js.paystack.co/v1/inline.js" async></script>
      </body>
    </html>
  )
}
