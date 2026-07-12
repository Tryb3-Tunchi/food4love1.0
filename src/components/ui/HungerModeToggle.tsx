'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useHungerMode } from '../providers/HungerModeProviders'

export function HungerModeToggle() {
  const { hungerMode, toggleHungerMode } = useHungerMode()

  return (
    <button
      onClick={toggleHungerMode}
      title={hungerMode ? 'Exit Hunger Mode' : 'Activate Hunger Mode 🔥'}
      className="flex items-center gap-2 rounded-full px-3.5 py-2 transition-all duration-300"
      style={{
        background: hungerMode
          ? 'linear-gradient(135deg, #3D1800, #5C2A00)'
          : 'rgba(0,0,0,0.04)',
        border: `1px solid ${hungerMode ? '#7A3800' : '#EAE4DA'}`,
        boxShadow: hungerMode
          ? '0 0 20px rgba(232,57,14,0.2), 0 2px 8px rgba(0,0,0,0.15)'
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <AnimatePresence mode="wait">
        {hungerMode ? (
          <motion.span
            key="fire"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="text-sm"
          >
            🔥
          </motion.span>
        ) : (
          <motion.span
            key="smile"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="text-sm"
          >
            😋
          </motion.span>
        )}
      </AnimatePresence>

      <span
        className="whitespace-nowrap text-xs font-bold"
        style={{ color: hungerMode ? '#FFB673' : '#4A4A4A' }}
      >
        {hungerMode ? 'Hunger Mode' : 'Hunger Mode'}
      </span>

      {/* Toggle pill */}
      <div
        className="relative h-4 w-8 rounded-full transition-all duration-300"
        style={{
          background: hungerMode
            ? 'linear-gradient(135deg, #E8390E, #F59E0B)'
            : '#D9D0C3',
        }}
      >
        <motion.div
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm"
          animate={{ left: hungerMode ? 'calc(100% - 14px)' : '2px' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      </div>
    </button>
  )
}
