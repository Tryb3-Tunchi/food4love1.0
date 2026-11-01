'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/db'
import { StoryViewer, type StoryViewerActions } from './StoryViewer'

// One arc per live story, like WhatsApp status. A single story is a full,
// slowly turning ring.
export function ringGradient(count: number) {
  const segments = Math.min(Math.max(count, 1), 10)
  if (segments === 1) {
    return 'conic-gradient(from 0deg, var(--accent), #ffb347, var(--accent))'
  }
  const arc = 360 / segments
  const gap = 8
  const stops = ['transparent 0deg ' + gap / 2 + 'deg']
  for (let i = 0; i < segments; i++) {
    const start = i * arc + gap / 2
    const end = (i + 1) * arc - gap / 2
    stops.push(`var(--accent) ${start}deg ${end}deg`)
    stops.push(`transparent ${end}deg ${end + gap}deg`)
  }
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

interface RingFrameProps {
  count: number
  shape?: 'circle' | 'rounded'
  thickness?: number
  gap?: number
  gapColor?: string
  className?: string
  children: ReactNode
}

// Draws the ring outside the avatar, so adding or removing it never moves
// anything on the page.
export function RingFrame({
  count,
  shape = 'circle',
  thickness = 3,
  gap = 2,
  gapColor = 'var(--bg)',
  className,
  children,
}: RingFrameProps) {
  const active = count > 0
  const spin = active && shape === 'circle' && count === 1
  const radius = (extra: number) =>
    shape === 'circle' ? '9999px' : `calc(1rem + ${extra}px)`

  return (
    <span className={cn('relative inline-block', className)}>
      {active && (
        <>
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute',
              spin &&
                'animate-[spin_8s_linear_infinite] motion-reduce:animate-none',
            )}
            style={{
              inset: -(thickness + gap),
              borderRadius: radius(thickness + gap),
              background: ringGradient(count),
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              inset: -gap,
              borderRadius: radius(gap),
              background: gapColor,
            }}
          />
        </>
      )}
      <span className="relative block">{children}</span>
    </span>
  )
}

interface StoryRingProps extends Omit<RingFrameProps, 'count'> {
  stories: Story[]
  author: { name: string; avatarUrl?: string | null }
  actions?: StoryViewerActions
}

// An avatar that shows a ring when the chef has a live story, and opens the
// story when tapped.
export function StoryRing({
  stories,
  author,
  actions,
  children,
  ...frame
}: StoryRingProps) {
  const [open, setOpen] = useState(false)

  if (stories.length === 0) {
    return (
      <RingFrame count={0} {...frame}>
        {children}
      </RingFrame>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${author.name}'s story`}
        className="inline-block rounded-full"
      >
        <RingFrame count={stories.length} {...frame}>
          {children}
        </RingFrame>
      </button>
      {open && (
        <StoryViewer
          stories={stories}
          author={author}
          actions={actions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
