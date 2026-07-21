'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Profile } from '@/types/db'
import { useRouter } from 'next/navigation'
import { Clock3 } from 'lucide-react'

interface MatchCelebrationProps {
  isOpen: boolean
  matchedChef: Profile | null
  currentUser: Profile
  matchId?: string
  onClose: () => void
}

// Particle colours from the design token system
const PARTICLE_COLOURS = [
  'var(--accent)', // pepper
  'var(--accent-alt)', // ember
  'var(--success)', // lime
  'var(--accent)',
  'var(--accent-alt)',
]

const FOOD_EMOJIS = ['🍽️', '❤️', '✨', '🥘', '⭐']

export function MatchCelebration({
  isOpen,
  matchedChef,
  currentUser,
  matchId,
  onClose,
}: MatchCelebrationProps) {
  const router = useRouter()

  return (
    <AnimatePresence>
      {isOpen && matchedChef && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(36,24,20,0.97) 0%, rgba(20,14,10,0.99) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Dot particle burst */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => {
              const angle = (i * 360) / 20
              const radius = Math.random() * 180 + 90
              const targetX = Math.cos((angle * Math.PI) / 180) * radius
              const targetY = Math.sin((angle * Math.PI) / 180) * radius
              const colour = PARTICLE_COLOURS[i % PARTICLE_COLOURS.length]
              const size = Math.random() * 8 + 5

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: '50vw', y: '46vh' }}
                  animate={{
                    opacity: 0,
                    scale: Math.random() * 1.4 + 0.5,
                    x: `calc(50vw + ${targetX}px)`,
                    y: `calc(46vh + ${targetY}px)`,
                  }}
                  transition={{
                    duration: 1.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.08 + (i % 4) * 0.04,
                  }}
                  style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: colour,
                    boxShadow: `0 0 12px ${colour}`,
                  }}
                />
              )
            })}
          </div>

          {/* Floating emoji particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {FOOD_EMOJIS.map((emoji, i) => (
              <motion.div
                key={emoji}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: `calc(50vw + ${(i - 2) * 55}px)`,
                  y: '50vh',
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.2, 0.8],
                  y: `calc(50vh - ${120 + i * 30}px)`,
                }}
                transition={{
                  duration: 2,
                  delay: 0.2 + i * 0.1,
                  ease: 'easeOut',
                }}
                className="absolute text-2xl"
              />
            ))}
          </div>

          {/* Pulsing ring behind avatars */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.4, 1.1], opacity: [0, 0.35, 0] }}
            transition={{ duration: 1.8, delay: 0.3, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-[46%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              border: '2px solid var(--accent)',
              boxShadow: '0 0 40px var(--accent)',
            }}
          />

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.82, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.38, delay: 0.12 }}
            className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7 px-6 text-center"
          >
            {/* Heading */}
            <div className="space-y-2">
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="text-sm font-semibold uppercase tracking-[0.22em]"
                style={{ color: 'var(--accent-alt)' }}
              >
                It&apos;s a
              </motion.p>
              <motion.h1
                initial={{ y: 24, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.32 }}
                className="gradient-text font-display text-6xl font-black tracking-[-0.03em]"
              >
                Match!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm"
                style={{ color: 'var(--text-3)' }}
              >
                You and{' '}
                <span className="font-semibold text-white">
                  {matchedChef.full_name}
                </span>{' '}
                liked each other
              </motion.p>
            </div>

            {/* Avatar pair */}
            <div className="my-2 flex items-center justify-center -space-x-5">
              <motion.div
                initial={{ x: -70, rotate: -14, opacity: 0 }}
                animate={{ x: 0, rotate: -5, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.45, delay: 0.42 }}
                className="z-10 rounded-full p-1.5 shadow-float"
                style={{
                  background: 'rgba(36,24,20,0.9)',
                  border: '2px solid rgba(255,255,255,0.12)',
                }}
              >
                <Avatar
                  src={currentUser.avatar_url}
                  name={currentUser.full_name}
                  size="xl"
                />
              </motion.div>

              <motion.div
                initial={{ scale: 0, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.65, delay: 0.6 }}
                className="h-13 w-13 relative z-20 flex items-center justify-center rounded-full text-2xl shadow-glow"
                style={{
                  background: 'var(--card)',
                  width: '3.25rem',
                  height: '3.25rem',
                  border: '2px solid rgba(232,90,42,0.3)',
                  boxShadow:
                    '0 0 24px var(--accent), 0 8px 20px rgba(0,0,0,0.3)',
                }}
              >
                ❤️
              </motion.div>

              <motion.div
                initial={{ x: 70, rotate: 14, opacity: 0 }}
                animate={{ x: 0, rotate: 5, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.45, delay: 0.42 }}
                className="z-10 rounded-full p-1.5 shadow-float"
                style={{
                  background: 'rgba(36,24,20,0.9)',
                  border: '2px solid rgba(232,90,42,0.35)',
                }}
              >
                <Avatar
                  src={matchedChef.avatar_url}
                  name={matchedChef.full_name}
                  size="xl"
                />
              </motion.div>
            </div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.62 }}
              className="flex w-full flex-col gap-3"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-[var(--radius-xl)] py-4 font-bold text-white shadow-warm"
                style={{
                  background: 'var(--accent)',
                }}
                onClick={() => {
                  onClose()
                  if (matchId) router.push(`/chat/${matchId}`)
                }}
              >
                Start Chatting 💬
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="transition-colors duration-200 hover:text-white"
                style={{ color: 'var(--text-3)' }}
                onClick={onClose}
              >
                Keep Swiping
              </Button>
            </motion.div>

            {/* 24h expiry hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-3)',
              }}
            >
              <Clock3
                className="h-3.5 w-3.5"
                style={{ color: 'var(--accent-alt)' }}
              />
              Match expires in 24 hours — say hello first
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
