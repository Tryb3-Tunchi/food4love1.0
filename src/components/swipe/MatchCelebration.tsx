'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Profile } from '@/types/db'
import { useRouter } from 'next/navigation'

interface MatchCelebrationProps {
  isOpen: boolean
  matchedChef: Profile | null
  currentUser: Profile
  matchId?: string
  onClose: () => void
}

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
          className="bg-[color:var(--char)]/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
        >
          {/* Burst Engine */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(16)].map((_, i) => {
              const angle = (i * 360) / 16
              const radius = Math.random() * 150 + 100
              const targetX = Math.cos((angle * Math.PI) / 180) * radius
              const targetY = Math.sin((angle * Math.PI) / 180) * radius

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: '50vw', y: '50vh' }}
                  animate={{
                    opacity: 0,
                    scale: Math.random() * 1.2 + 0.6,
                    x: `calc(50vw + ${targetX}px)`,
                    y: `calc(50vh + ${targetY}px)`,
                  }}
                  transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }}
                  className="absolute h-3 w-3 rounded-full bg-[color:var(--accent)]"
                  style={{ boxShadow: '0 0 10px var(--accent)' }}
                />
              )
            })}
          </div>

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.4, delay: 0.15 }}
            className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 px-6 text-center"
          >
            <div className="space-y-2">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="font-display text-5xl font-black tracking-tight text-white"
              >
                It's a <span className="gradient-text">Match!</span>
              </motion.h1>
              <p className="text-base text-[color:var(--text-3)]">
                You and{' '}
                <span className="font-medium text-white">
                  {matchedChef.full_name}
                </span>{' '}
                liked each other
              </p>
            </div>

            {/* Avatar Interlocking Track */}
            <div className="isolation-auto my-4 flex items-center justify-center -space-x-4">
              <motion.div
                initial={{ x: -60, rotate: -10, opacity: 0 }}
                animate={{ x: 0, rotate: -4, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.4 }}
                className="z-10 rounded-full border-2 border-white/20 bg-[color:var(--char)] p-1 shadow-float"
              >
                <Avatar
                  src={currentUser.avatar_url}
                  name={currentUser.full_name}
                  size="xl"
                />
              </motion.div>

              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.6 }}
                className="z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-glow"
              >
                ❤️
              </motion.div>

              <motion.div
                initial={{ x: 60, rotate: 10, opacity: 0 }}
                animate={{ x: 0, rotate: 4, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.4 }}
                className="border-[color:var(--accent)]/40 z-10 rounded-full border-2 bg-[color:var(--char)] p-1 shadow-float"
              >
                <Avatar
                  src={matchedChef.avatar_url}
                  name={matchedChef.full_name}
                  size="xl"
                />
              </motion.div>
            </div>

            {/* Actions Panel */}
            <div className="flex w-full flex-col gap-3 px-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-[var(--radius-md)] bg-[color:var(--accent)] py-4 font-bold text-white shadow-warm hover:bg-[color:var(--accent-strong)]"
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
                className="text-[color:var(--text-3)] transition-colors duration-200 hover:text-white"
                onClick={onClose}
              >
                Keep Swiping
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
