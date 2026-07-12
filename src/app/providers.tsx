'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import { Shell } from '@/components/layout/Shell'
import { AppTour } from '@/components/tour/AppTour'
import { HungerModeProvider } from '@/components/providers/HungerModeProviders'

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  )

  return (
    <QueryClientProvider client={qc}>
      <HungerModeProvider>
        <Shell>{children}</Shell>
        <AppTour />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#0D0D0D',
              border: '1px solid #EAE4DA',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            },
            success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
            error: { iconTheme: { primary: '#E8390E', secondary: '#fff' } },
          }}
        />
      </HungerModeProvider>
    </QueryClientProvider>
  )
}
