"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface SimpleProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface MatchCelebrationProps {
  isOpen: boolean;
  matchedChef: SimpleProfile | null;
  currentUser: SimpleProfile | null;
  matchId?: string;
  onClose: () => void;
}

export function MatchCelebration({ isOpen, matchedChef, currentUser, onClose }: MatchCelebrationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      setParticles(
        Array.from({ length: 24 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          color: ["#E8390E", "#F59E0B", "#84CC16", "#FF6B35", "#FFD700"][i % 5],
        }))
      );
    }
  }, [isOpen]);

  const chefName = matchedChef?.full_name || "Chef";
  const userName = currentUser?.full_name || "You";

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
                x: [`${p.x}vw`, `${p.x + (Math.random() - 0.5) * 30}vw`, `${p.x + (Math.random() - 0.5) * 40}vw`],
                opacity: [1, 1, 0],
                scale: [0, 1.2, 0.3],
                rotate: [0, 360, 720],
              }}
              transition={{ duration: 2.8, delay: Math.random() * 0.6, ease: "easeOut" }}
              className="absolute top-0 w-3 h-3 rounded-full"
              style={{ backgroundColor: p.color }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative bg-gradient-to-b from-[var(--card)] to-[var(--bg)] border border-[var(--border)] rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--bg-2)] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              className="flex justify-center -space-x-5 mb-6"
            >
              <div className="relative w-24 h-24 rounded-full border-4 border-[var(--bg)] overflow-hidden shadow-xl bg-[var(--bg-2)]">
                {currentUser?.avatar_url ? (
                  <Image src={currentUser.avatar_url} alt={userName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
                )}
              </div>
              <div className="relative w-24 h-24 rounded-full border-4 border-[var(--bg)] overflow-hidden shadow-xl z-10 bg-[var(--bg-2)]">
                {matchedChef.avatar_url ? (
                  <Image src={matchedChef.avatar_url} alt={chefName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">👨‍🍳</div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                <h2 className="text-3xl font-black bg-gradient-to-r from-[var(--primary)] to-[#ff6b35] bg-clip-text text-transparent">
                  It&apos;s a Match!
                </h2>
                <Sparkles className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <p className="text-[var(--text-muted)] mb-8">
                You and <span className="font-bold text-[var(--text)]">{chefName}</span> liked each other
              </p>

              <div className="space-y-3">
                <Link
                  href={`/chat/${matchedChef.id}`}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-2xl font-bold transition-all shadow-lg shadow-[var(--primary)]/25 active:scale-95"
                >
                  <MessageCircle className="w-5 h-5" />
                  Send Message
                </Link>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-[var(--bg-2)] hover:bg-[var(--bg-2)]/80 text-[var(--text)] rounded-2xl font-semibold transition-colors active:scale-95"
                >
                  Keep Swiping
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}