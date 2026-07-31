'use client'

import { motion } from 'framer-motion'
import { X, Star, Heart } from 'lucide-react'

interface SwipeActionsProps {
  onPass: () => void
  onLike: () => void
  onSuperlike?: () => void
  disabled?: boolean
}

export function SwipeActions({
  onPass,
  onLike,
  onSuperlike,
  disabled,
}: SwipeActionsProps) {
  return (
    <div className="flex select-none items-center justify-center gap-6 px-4 py-3">
      {/* PASS */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onPass}
        disabled={disabled}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[#ffe0e0] bg-white shadow-xl shadow-red-500/10 transition-colors hover:border-red-300 hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Pass"
      >
        <X className="h-8 w-8 text-[#ff4458]" strokeWidth={2.5} />
      </motion.button>

      {/* SUPERLIKE */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onSuperlike || onLike}
        disabled={disabled}
        className="flex h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-[#e0f7fa] bg-white shadow-xl shadow-cyan-500/10 transition-colors hover:border-cyan-300 hover:bg-cyan-50 active:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Superlike"
      >
        <Star
          className="h-6 w-6 fill-[#26c6da]/20 text-[#26c6da]"
          strokeWidth={2.5}
        />
      </motion.button>

      {/* LIKE */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onLike}
        disabled={disabled}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[#e8f5e9] bg-white shadow-xl shadow-green-500/10 transition-colors hover:border-green-300 hover:bg-green-50 active:bg-green-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Like"
      >
        <Heart
          className="h-8 w-8 fill-[#4ade80]/20 text-[#4ade80]"
          strokeWidth={2.5}
        />
      </motion.button>
    </div>
  )
}
