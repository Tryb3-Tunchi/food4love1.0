'use client'
import { Bell } from 'lucide-react'
import { useHungerMode } from '@/components/providers/HungerModeProviders'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { motion, AnimatePresence } from 'framer-motion'

export function AppTopBar() {
  const { hungerMode, toggleHungerMode } = useHungerMode()
  const { unreadMessages, newMatches } = useNotificationStore()
  const totalNotifs = unreadMessages + newMatches

  return (
    <div className="f4l-nav flex shrink-0 items-center justify-between border-b px-4 py-3 lg:hidden">
      <span
        className="text-base font-extrabold tracking-tight"
        style={{ color: 'var(--text-1)' }}
      >
        Food<span style={{ color: 'var(--accent)' }}>4</span>Love
      </span>

      <div className="flex items-center gap-2">
        {/* Hunger mode toggle */}
        <button
          onClick={toggleHungerMode}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-300"
          style={{
            background: hungerMode
              ? 'color-mix(in srgb, var(--accent-alt) 18%, white 82%)'
              : 'rgba(255,255,255,0.65)',
            border: `1px solid ${hungerMode ? 'var(--accent-alt)' : 'var(--border)'}`,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={hungerMode ? 'fire' : 'smile'}
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 0.3 }}
              className="text-sm"
            >
              {hungerMode ? '🔥' : '😋'}
            </motion.span>
          </AnimatePresence>
          <span
            className="text-xs font-bold"
            style={{
              color: hungerMode ? 'var(--accent-alt)' : 'var(--text-3)',
            }}
          >
            {hungerMode ? 'Hungry' : 'Chill'}
          </span>
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all"
          style={{
            background: 'rgba(255,255,255,0.68)',
            border: '1px solid var(--border)',
          }}
        >
          <Bell className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
          {totalNotifs > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {totalNotifs > 9 ? '9+' : totalNotifs}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
