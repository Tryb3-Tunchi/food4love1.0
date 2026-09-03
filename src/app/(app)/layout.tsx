import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { AmbientBackground } from '@/components/ui/AmbientBackground'

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
    <>
      <AmbientBackground>
        {children}
        <BottomNav />
      </AmbientBackground>
    </>
  )
}
