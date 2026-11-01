'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Flame, Moon, Sun, Sunset } from 'lucide-react'

// Slow, soft colour that drifts behind the top of Discover.
export function HeaderAurora() {
  const reduceMotion = useReducedMotion()
  const drift = (x: number, y: number, seconds: number) =>
    reduceMotion
      ? {}
      : {
          animate: { x: [0, x, 0], y: [0, y, 0], scale: [1, 1.18, 1] },
          transition: {
            duration: seconds,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          },
        }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, black 45%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 45%, transparent)',
      }}
    >
      <motion.div
        className="absolute -left-20 -top-28 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--accent)', opacity: 0.28 }}
        {...drift(70, 24, 13)}
      />
      <motion.div
        className="absolute -right-24 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: '#F6C453', opacity: 0.34 }}
        {...drift(-60, 34, 16)}
      />
      <motion.div
        className="absolute -top-10 left-1/3 h-52 w-52 rounded-full blur-3xl"
        style={{ background: '#FF9A85', opacity: 0.24 }}
        {...drift(40, -14, 19)}
      />
    </div>
  )
}

// A greeting that knows the time of day: the sun turns in the morning, a
// sunset glows in the evening, and the title shimmers.
export function DiscoverGreeting({
  firstName,
  streak,
  title,
}: {
  firstName?: string
  streak: number
  title: string
}) {
  const reduceMotion = useReducedMotion()
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => setHour(new Date().getHours()), [])

  const phase =
    hour === null
      ? null
      : hour < 12
        ? { text: 'Good morning', Icon: Sun, tone: '#F59E0B', spin: true }
        : hour < 17
          ? { text: 'Good afternoon', Icon: Sun, tone: '#F97316', spin: true }
          : hour < 21
            ? {
                text: 'Good evening',
                Icon: Sunset,
                tone: '#D4457B',
                spin: false,
              }
            : { text: 'Good night', Icon: Moon, tone: '#7C83E8', spin: false }

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)]">
        {phase && (
          <motion.span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: `${phase.tone}26`, color: phase.tone }}
            animate={
              reduceMotion
                ? {}
                : phase.spin
                  ? { rotate: 360 }
                  : { scale: [1, 1.15, 1], y: [0, -1.5, 0] }
            }
            transition={
              phase.spin
                ? { duration: 18, repeat: Infinity, ease: 'linear' }
                : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <phase.Icon className="h-3.5 w-3.5" />
          </motion.span>
        )}
        <span>
          {phase?.text ?? 'Welcome'}
          {firstName ? `, ${firstName}` : ''}
        </span>
        {streak > 1 && (
          <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            <motion.span
              className="flex"
              animate={
                reduceMotion
                  ? {}
                  : {
                      scale: [1, 1.25, 0.95, 1.15, 1],
                      rotate: [0, -8, 6, -4, 0],
                    }
              }
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <Flame className="h-3 w-3" />
            </motion.span>
            {streak}
          </span>
        )}
      </p>
      <motion.h1
        className="bg-clip-text font-heading text-[1.45rem] font-bold leading-tight text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(105deg, var(--text-1) 35%, var(--accent) 50%, var(--text-1) 65%)',
          backgroundSize: '260% 100%',
          WebkitBackgroundClip: 'text',
        }}
        animate={
          reduceMotion
            ? { backgroundPosition: '100% 0' }
            : { backgroundPosition: ['100% 0', '0% 0'] }
        }
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatDelay: 3,
          ease: 'easeInOut',
        }}
      >
        {title}
      </motion.h1>
    </div>
  )
}
