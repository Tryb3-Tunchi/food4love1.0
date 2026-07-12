'use client'
import { usePathname } from 'next/navigation'
import { BottomNav } from './BottomNav'
import { SidebarNav } from './SidebarNav'
import { AppTopBar } from './AppTopBar'
import { useAuthStore } from '@/stores/useAuthStore'

const MARKETING_ROUTES = ['/']

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const profile = useAuthStore((s) => s.profile)
  const isAuth = ['/login', '/signup', '/verify'].includes(pathname)
  const isOnboarding = pathname.startsWith('/onboarding')
  const isCookPublic = pathname.startsWith('/cook/')
  const isMarketing = MARKETING_ROUTES.includes(pathname)
  const appTheme = profile?.role === 'cook' ? 'theme-cook' : 'theme-buyer'

  if (isMarketing) {
    return (
      <div className="min-h-dvh bg-[color:var(--bg)] text-[color:var(--text-1)]">
        {children}
      </div>
    )
  }

  if (isAuth || isOnboarding || isCookPublic) {
    return (
      <div
        className={`min-h-dvh text-[color:var(--text-1)] ${isCookPublic ? 'theme-cook' : 'theme-buyer'}`}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={`f4l-app-shell ${appTheme} flex min-h-dvh overflow-hidden text-[color:var(--text-1)]`}
    >
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <AppTopBar />
        <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="f4l-app-main flex min-h-[calc(100dvh-7rem)] flex-col px-3 py-3 sm:px-4 sm:py-4">
              {children}
            </div>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
