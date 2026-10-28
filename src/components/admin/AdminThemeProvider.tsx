'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type AdminTheme = 'dark' | 'light'
const AdminThemeContext = createContext<{
  theme: AdminTheme
  toggleTheme: () => void
} | null>(null)

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>('dark')

  useEffect(() => {
    const stored = window.localStorage.getItem('food4love-admin-theme')
    if (stored === 'light' || stored === 'dark') setTheme(stored)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('food4love-admin-theme', theme)
  }, [theme])

  return (
    <AdminThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
      }}
    >
      <div className={`f4l-admin-shell f4l-admin-${theme}`} data-admin-theme={theme}>
        {children}
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
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-text)] transition hover:brightness-110"
    >
      {context.theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}