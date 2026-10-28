'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AdminNavigation } from '@/components/admin/AdminNavigation'

type AdminTheme = 'dark' | 'light'
const AdminThemeContext = createContext<{
  theme: AdminTheme
  toggleTheme: () => void
} | null>(null)

export function AdminThemeProvider({
  children,
  permissions,
}: {
  children: React.ReactNode
  permissions: string[]
}) {
  const [theme, setTheme] = useState<AdminTheme>('dark')
  const [themeLoaded, setThemeLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('food4love-admin-theme')
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      // The admin console remains usable when browser storage is disabled.
    } finally {
      setThemeLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!themeLoaded) return
    try {
      window.localStorage.setItem('food4love-admin-theme', theme)
    } catch {
      // Theme selection remains available for the current page session.
    }
  }, [theme, themeLoaded])

  return (
    <AdminThemeContext.Provider
      value={{
        theme,
        toggleTheme: () =>
          setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      }}
    >
      <div
        className={`f4l-admin-shell f4l-admin-${theme}`}
        data-admin-theme={theme}
      >
        <div className="min-h-screen lg:flex">
          <aside className="hidden w-64 shrink-0 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
            <div className="border-b border-[var(--admin-border)] px-6 py-5">
              <p className="font-display text-lg font-bold tracking-tight text-[var(--admin-text)]">
                Food4Love
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--admin-muted)]">
                Operations console
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminNavigation permissions={permissions} />
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="bg-[var(--admin-surface)]/95 sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-[var(--admin-border)] px-4 backdrop-blur sm:px-6 lg:px-8">
              <div className="lg:hidden">
                <p className="font-display text-base font-bold text-[var(--admin-text)]">
                  Food4Love
                </p>
                <p className="text-[10px] font-medium text-[var(--admin-muted)]">
                  Operations console
                </p>
              </div>
              <p className="hidden text-sm font-medium text-[var(--admin-muted)] lg:block">
                Admin workspace
              </p>
              <AdminThemeToggle />
            </header>
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] lg:hidden">
              <AdminNavigation permissions={permissions} mobile />
            </div>
            <main>{children}</main>
          </div>
        </div>
      </div>
    </AdminThemeContext.Provider>
  )
}

export function AdminThemeToggle() {
  const context = useContext(AdminThemeContext)
  if (!context) return null
  return (
    <button
      type="button"
      onClick={context.toggleTheme}
      aria-label={`Switch to ${context.theme === 'dark' ? 'light' : 'dark'} admin theme`}
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-text)] transition hover:bg-[var(--admin-hover)]"
    >
      {context.theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
