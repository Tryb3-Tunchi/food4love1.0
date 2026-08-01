'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface SimpleProfile {
  id: string
  full_name?: string | null
  avatar_url?: string | null
}

interface MatchCelebrationProps {
  isOpen: boolean
  matchedChef: SimpleProfile | null
  currentUser: SimpleProfile | null
  matchId?: string
  onClose: () => void
}

export function MatchCelebration({
  isOpen,
  matchedChef,
  currentUser,
  onClose,
}: MatchCelebrationProps) {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; color: string }>
  >([])

  useEffect(() => {
    if (isOpen) {
      setParticles(
        Array.from({ length: 24 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          color: ['#E8390E', '#F59E0B', '#84CC16', '#FF6B35', '#FFD700'][i % 5],
        })),
      )
    }
  }, [isOpen])

  const chefName = matchedChef?.full_name || 'Chef'
  const userName = currentUser?.full_name || 'You'

  return (
    <AnimatePresence>
      {isOpen && matchedChef && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, scale: 0 }}
              animate={{
                y: [0, -200, 800],
                x: [
                  `${p.x}vw`,
                  `${p.x + (Math.random() - 0.5) * 30}vw`,
                  `${p.x + (Math.random() - 0.5) * 40}vw`,
                ],
                opacity: [1, 1, 0],
                scale: [0, 1.2, 0.3],
                rotate: [0, 360, 720],
              }}
              transition={{
                duration: 2.8,
                delay: Math.random() * 0.6,
                ease: 'easeOut',
              }}
              className="absolute top-0 h-3 w-3 rounded-full"
              style={{ backgroundColor: p.color }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="relative mx-4 w-full max-w-sm rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[var(--card)] to-[var(--bg)] p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-[var(--text-muted)]" />
            </button>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="mb-6 flex justify-center -space-x-5"
            >
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--bg)] bg-[var(--bg-2)] shadow-xl">
                {currentUser?.avatar_url ? (
                  <Image
                    src={currentUser.avatar_url}
                    alt={userName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    👤
                  </div>
                )}
              </div>
              <div className="relative z-10 h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--bg)] bg-[var(--bg-2)] shadow-xl">
                {matchedChef.avatar_url ? (
                  <Image
                    src={matchedChef.avatar_url}
                    alt={chefName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    👨‍🍳
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="mb-1 flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="bg-gradient-to-r from-[var(--primary)] to-[#ff6b35] bg-clip-text text-3xl font-black text-transparent">
                  It&apos;s a Match!
                </h2>
                <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <p className="mb-8 text-[var(--text-muted)]">
                You and{' '}
                <span className="font-bold text-[var(--text)]">{chefName}</span>{' '}
                liked each other
              </p>

              <div className="space-y-3">
                <Link
                  href={`/chat/${matchedChef.id}`}
                  onClick={onClose}
                  className="hover:bg-[var(--primary)]/90 shadow-[var(--primary)]/25 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3.5 font-bold text-white shadow-lg transition-all active:scale-95"
                >
                  <MessageCircle className="h-5 w-5" />
                  Send Message
                </Link>
                <button
                  onClick={onClose}
                  className="hover:bg-[var(--bg-2)]/80 w-full rounded-2xl bg-[var(--bg-2)] py-3.5 font-semibold text-[var(--text)] transition-colors active:scale-95"
                >
                  Keep Swiping
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
