'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '@/stores/useAuthStore'
import { CHI_ROLES } from '@/lib/chefChi'
import { ChefChiAvatar } from './ChefChiAvatar'
import { ChefChiPanel } from './ChefChiPanel'

const HINT_KEY = 'chef-chi-hint-seen'

// The floating "Chat with Chef Chi" button on the Chat page. Tapping it opens
// the AI chat as a popup, like Grok or ChatGPT, so the chat with buyers stays
// exactly where it was.
export function ChefChiLauncher() {
  const profile = useAuthStore((s) => s.profile)
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)

  const allowed =
    !!profile && (CHI_ROLES as readonly string[]).includes(profile.role)

  // Say hello once, then stay quiet.
  useEffect(() => {
    if (!allowed) return
    try {
      if (localStorage.getItem(HINT_KEY)) return
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      return
    }
    const show = window.setTimeout(() => setHint(true), 1200)
    const hide = window.setTimeout(() => setHint(false), 8000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [allowed])

  if (!allowed || !profile) return null

  const firstName = profile.full_name?.trim().split(' ')[0] ?? ''

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.div
            key="chi-launcher"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="fixed bottom-[6.5rem] right-4 z-40 flex flex-col items-end gap-2"
          >
            <AnimatePresence>
              {hint && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  className="max-w-[14rem] rounded-2xl rounded-br-md px-3.5 py-2.5 text-xs font-medium leading-snug shadow-lift"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                >
                  Hi {firstName || 'chef'}! Need help with your bio, pricing or
                  ideas? Ask me.
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={() => {
                setHint(false)
                setOpen(true)
              }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.94 }}
              aria-label="Chat with Chef Chi"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-4 shadow-lift"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <span className="relative">
                <ChefChiAvatar size={44} />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--card)] bg-[var(--success)]" />
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                Chef Chi
              </span>
              <span className="f4l-badge f4l-badge-accent">AI</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <ChefChiPanel
            userId={profile.id}
            role={profile.role}
            firstName={firstName}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
