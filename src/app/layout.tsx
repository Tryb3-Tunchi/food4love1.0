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
    icon: '/logo4lfood11.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#07533F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
