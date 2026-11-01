'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { BookmarkCheck, Check, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Story } from '@/types/db'

const IMAGE_MS = 6000
const TAP_MS = 220

export interface StoryViewerActions {
  onSave?: (story: Story) => void | Promise<void>
  onDelete?: (story: Story) => void | Promise<void>
  isSaved?: (story: Story) => boolean
}

interface StoryViewerProps {
  stories: Story[]
  startIndex?: number
  author: { name: string; avatarUrl?: string | null }
  actions?: StoryViewerActions
  onClose: () => void
}

// Full-screen story player: progress bars, tap to move, hold to pause.
export function StoryViewer({
  stories,
  startIndex = 0,
  author,
  actions,
  onClose,
}: StoryViewerProps) {
  const [index, setIndex] = useState(
    Math.min(startIndex, Math.max(stories.length - 1, 0)),
  )
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [busy, setBusy] = useState(false)
  const progressRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pressStart = useRef(0)

  const story = stories[index]
  const isVideo = !!story && !story.image_url && !!story.video_url

  useEffect(() => {
    if (!stories.length) onClose()
    else if (index > stories.length - 1) setIndex(stories.length - 1)
  }, [stories.length, index, onClose])

  useEffect(() => {
    progressRef.current = 0
    setProgress(0)
  }, [story?.id])

  const goNext = useCallback(() => {
    if (index >= stories.length - 1) {
      onClose()
      return
    }
    progressRef.current = 0
    setProgress(0)
    setIndex(index + 1)
  }, [index, stories.length, onClose])

  const goPrev = useCallback(() => {
    progressRef.current = 0
    setProgress(0)
    if (index > 0) setIndex(index - 1)
    else if (videoRef.current) videoRef.current.currentTime = 0
  }, [index])

  // Photos advance on a timer. Videos advance when they finish.
  useEffect(() => {
    if (!story || isVideo || paused) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      progressRef.current += (now - last) / IMAGE_MS
      last = now
      if (progressRef.current >= 1) {
        setProgress(1)
        goNext()
        return
      }
      setProgress(progressRef.current)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [story, isVideo, paused, goNext])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (paused) video.pause()
    else void video.play().catch(() => {})
  }, [paused, story?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, goNext, goPrev])

  if (!story) return null

  const expired = new Date(story.expires_at).getTime() <= Date.now()
  const saved = actions?.isSaved?.(story) ?? false

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false)
    if (Date.now() - pressStart.current > TAP_MS) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientX - rect.left < rect.width * 0.35) goPrev()
    else goNext()
  }

  const runAction = async (action: () => void | Promise<void>) => {
    setBusy(true)
    setPaused(true)
    try {
      await action()
    } finally {
      setBusy(false)
      setPaused(false)
    }
  }

  const handleDelete = () => {
    if (!actions?.onDelete || busy) return
    if (!window.confirm('Delete this story? This cannot be undone.')) return
    void runAction(() => actions.onDelete!(story))
  }

  const handleSave = () => {
    if (!actions?.onSave || busy || saved) return
    void runAction(() => actions.onSave!(story))
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${author.name}'s story`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black"
    >
      <div className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[94vh] sm:rounded-3xl">
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={() => {
            pressStart.current = Date.now()
            setPaused(true)
          }}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setPaused(false)}
        >
          {story.image_url ? (
            <img
              key={story.id}
              src={story.image_url}
              alt={story.caption ?? 'Story'}
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            <video
              key={story.id}
              ref={videoRef}
              src={story.video_url ?? undefined}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(e) => {
                const video = e.currentTarget
                if (!video.duration) return
                progressRef.current = video.currentTime / video.duration
                setProgress(progressRef.current)
              }}
              onEnded={goNext}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-3">
          {stories.map((s, i) => (
            <div
              key={s.id}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-5 z-10 flex items-center gap-3 px-3 pt-3 text-white">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-bold">
            {author.avatarUrl ? (
              <img
                src={author.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(author.name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{author.name}</p>
            <p className="text-xs text-white/70">
              {formatDistanceToNowStrict(new Date(story.created_at), {
                addSuffix: true,
              })}
              {expired ? ' · Ended' : ''}
            </p>
          </div>
          {isVideo && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 px-4 pb-6 text-white">
          {story.caption && (
            <p className="text-center text-base font-medium leading-snug drop-shadow">
              {story.caption}
            </p>
          )}
          {(actions?.onSave || actions?.onDelete) && (
            <div className="flex items-center justify-center gap-2">
              {actions.onSave && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy || saved}
                  className="flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-md disabled:opacity-70"
                >
                  {saved ? (
                    <>
                      <Check className="h-4 w-4" />
                      On your profile
                    </>
                  ) : (
                    <>
                      <BookmarkCheck className="h-4 w-4" />
                      Save to profile
                    </>
                  )}
                </button>
              )}
              {actions.onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  aria-label="Delete story"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md disabled:opacity-70"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
