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
          className="fixed inset-0 z-50 flex items-center justify-center bg-char/90 backdrop-blur-md"
        >
          {/* Particle burst - CSS only */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0, x: '50vw', y: '50vh' }}
                animate={{
                  opacity: 0,
                  scale: 1,
                  x: `${Math.random() * 100}vw`,
                  y: `${Math.random() * 100}vh`,
                }}
                transition={{ duration: 1.2, delay: i * 0.05 }}
                className="absolute h-3 w-3 rounded-full bg-ember"
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            className="relative z-10 flex flex-col items-center gap-6 px-8 text-center"
          >
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="font-display text-4xl font-bold text-white"
            >
              It's a <span className="text-ember">Match!</span>
            </motion.h1>
            <p className="text-base text-white/70">
              You and {matchedChef.full_name} liked each other
            </p>

            <div className="flex items-center gap-4">
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Avatar
                  src={currentUser.avatar_url}
                  name={currentUser.full_name}
                  size="xl"
                  className="border-4 border-white/20"
                />
              </motion.div>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: 'spring', bounce: 0.6 }}
                className="text-4xl"
              >
                ❤️
              </motion.span>
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Avatar
                  src={matchedChef.avatar_url}
                  name={matchedChef.full_name}
                  size="xl"
                  className="border-4 border-pepper/40"
                />
              </motion.div>
            </div>

            <div className="flex w-full max-w-xs flex-col gap-3">
              <Button
                variant="ember"
                size="lg"
                className="w-full"
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
                className="text-white/70 hover:text-white"
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
