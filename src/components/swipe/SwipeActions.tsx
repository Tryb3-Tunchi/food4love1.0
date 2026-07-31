"use client";

import { motion } from "framer-motion";
import { X, Star, Heart } from "lucide-react";

interface SwipeActionsProps {
  onPass: () => void;
  onLike: () => void;
  onSuperlike?: () => void;
  disabled?: boolean;
}

export function SwipeActions({ onPass, onLike, onSuperlike, disabled }: SwipeActionsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-3 px-4 select-none">
      {/* PASS */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onPass}
        disabled={disabled}
        className="w-[72px] h-[72px] rounded-full bg-white border-2 border-[#ffe0e0] shadow-xl shadow-red-500/10 flex items-center justify-center transition-colors hover:bg-red-50 hover:border-red-300 disabled:opacity-30 disabled:cursor-not-allowed active:bg-red-100"
        aria-label="Pass"
      >
        <X className="w-8 h-8 text-[#ff4458]" strokeWidth={2.5} />
      </motion.button>

      {/* SUPERLIKE */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onSuperlike || onLike}
        disabled={disabled}
        className="w-[56px] h-[56px] rounded-full bg-white border-2 border-[#e0f7fa] shadow-xl shadow-cyan-500/10 flex items-center justify-center transition-colors hover:bg-cyan-50 hover:border-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed active:bg-cyan-100"
        aria-label="Superlike"
      >
        <Star className="w-6 h-6 text-[#26c6da] fill-[#26c6da]/20" strokeWidth={2.5} />
      </motion.button>

      {/* LIKE */}
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={onLike}
        disabled={disabled}
        className="w-[72px] h-[72px] rounded-full bg-white border-2 border-[#e8f5e9] shadow-xl shadow-green-500/10 flex items-center justify-center transition-colors hover:bg-green-50 hover:border-green-300 disabled:opacity-30 disabled:cursor-not-allowed active:bg-green-100"
        aria-label="Like"
      >
        <Heart className="w-8 h-8 text-[#4ade80] fill-[#4ade80]/20" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}