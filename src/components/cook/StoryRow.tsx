'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Trash2, X } from 'lucide-react'
import type { Story } from '@/types/db'

interface StoryRowProps {
  stories: Story[]
  onDelete?: (story: Story) => void
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours}h left`
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`
}

export function StoryRow({ stories, onDelete }: StoryRowProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const current = openIndex === null ? null : stories[openIndex]

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null)
      if (e.key === 'ArrowRight')
        setOpenIndex((i) => (i !== null && i < stories.length - 1 ? i + 1 : i))
      if (e.key === 'ArrowLeft')
        setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex, stories.length])

  useEffect(() => {
    if (openIndex !== null && openIndex >= stories.length) {
      setOpenIndex(stories.length ? stories.length - 1 : null)
    }
  }, [openIndex, stories.length])

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {stories.map((story, index) => (
          <button
            key={story.id}
            onClick={() => setOpenIndex(index)}
            className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-black"
            style={{ borderColor: 'var(--accent)' }}
            aria-label="Open story"
          >
            {story.image_url ? (
              <img
                src={story.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <video
                  src={story.video_url ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="h-3 w-3" fill="currentColor" />
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="relative flex h-full w-full max-w-md flex-col justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 text-white">
              <span className="text-xs font-semibold">
                {openIndex! + 1} / {stories.length}
                <span className="ml-2 font-normal text-white/70">
                  {timeLeft(current.expires_at)}
                </span>
              </span>
              <div className="flex gap-2">
                {onDelete && (
                  <button
                    onClick={() => onDelete(current)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60"
                    aria-label="Delete story"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpenIndex(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {current.image_url ? (
              <img
                key={current.id}
                src={current.image_url}
                alt={current.caption ?? 'Story'}
                className="max-h-[80vh] w-full object-contain"
              />
            ) : (
              <video
                key={current.id}
                src={current.video_url ?? undefined}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] w-full"
              />
            )}

            {current.caption && (
              <p className="px-4 pt-3 text-center text-sm text-white">
                {current.caption}
              </p>
            )}

            {openIndex! > 0 && (
              <button
                onClick={() => setOpenIndex(openIndex! - 1)}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Previous story"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {openIndex! < stories.length - 1 && (
              <button
                onClick={() => setOpenIndex(openIndex! + 1)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Next story"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
