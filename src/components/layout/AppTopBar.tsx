'use client'
import { useHungerMode } from '@/components/providers/HungerModeProviders'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { Brand } from '@/components/ui/Brand'

export function AppTopBar() {
  const { hungerMode, toggleHungerMode } = useHungerMode()

  return (
    <div className="f4l-nav flex shrink-0 items-center justify-between border-b px-4 py-3 lg:hidden">
      <Brand href="/swipe" size="compact" />

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

        <NotificationCenter />
      </div>
    </div>
  )
}
