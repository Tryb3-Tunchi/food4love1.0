import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { AppTour } from '@/components/tour/AppTour'
import { HungerModeProvider } from '@/components/providers/HungerModeProviders'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return (
    <HungerModeProvider>
      <AmbientBackground>
        {children}
        <BottomNav />
        <AppTour />
      </AmbientBackground>
    </HungerModeProvider>
  )
}
