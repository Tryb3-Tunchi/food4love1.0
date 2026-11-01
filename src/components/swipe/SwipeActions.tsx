'use client'

import { motion } from 'framer-motion'
import { X, Star, Heart } from 'lucide-react'

interface SwipeActionsProps {
  onPass: () => void
  onLike: () => void
  onSuperlike?: () => void
  disabled?: boolean
}

const glass =
  'flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-lg backdrop-blur-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30'

export function SwipeActions({
  onPass,
  onLike,
  onSuperlike,
  disabled,
}: SwipeActionsProps) {
  return (
    <div
      data-tour="swipe-actions"
      className="flex select-none items-center justify-center gap-5 px-4 py-2"
    >
      {/* PASS */}
      <div className="flex flex-col items-center gap-1">
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.86 }}
          onClick={onPass}
          disabled={disabled}
          className={`${glass} h-14 w-14 text-[var(--text-2)] hover:border-rose-300 hover:text-rose-500`}
          aria-label="Pass"
        >
          <X className="h-6 w-6" strokeWidth={2.4} />
        </motion.button>
        <span className="text-[10px] font-semibold text-[var(--text-3)]">
          Pass
        </span>
      </div>

      {/* LIKE */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full opacity-25 motion-reduce:hidden"
            style={{ background: 'var(--accent)', animationDuration: '2.4s' }}
          />
          <motion.button
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            onClick={onLike}
            disabled={disabled}
            className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #ff9a52, var(--accent))',
              boxShadow: 'var(--shadow-warm)',
            }}
            aria-label="Like"
          >
            <Heart className="h-8 w-8 fill-white" strokeWidth={2} />
          </motion.button>
        </div>
        <span className="text-[10px] font-semibold text-[var(--text-3)]">
          Like
        </span>
      </div>

      {/* STAR */}
      <div className="flex flex-col items-center gap-1">
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.86 }}
          onClick={onSuperlike || onLike}
          disabled={disabled}
          className={`${glass} h-14 w-14 text-amber-500 hover:border-amber-300`}
          aria-label="Superlike"
        >
          <Star className="h-6 w-6 fill-amber-400/30" strokeWidth={2.2} />
        </motion.button>
        <span className="text-[10px] font-semibold text-[var(--text-3)]">
          Star
        </span>
      </div>
    </div>
  )
}
