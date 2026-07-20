import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

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
    icon: '/favicon.svg', // Placed inside the /public folder
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#E87428',
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
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
