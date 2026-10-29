'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface StoryHighlight {
  id: string
  cook_id: string
  image_url: string | null
  video_url: string | null
  caption: string | null
  created_at: string
  cook: { full_name: string | null; avatar_url: string | null }
}

export function StoryHighlights() {
  const [stories, setStories] = useState<StoryHighlight[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: rows, error: storyError } = await supabase
      .from('stories')
      .select('id, cook_id, image_url, video_url, caption, created_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    if (storyError) throw storyError
    const cookIds = Array.from(
      new Set((rows ?? []).map((story) => story.cook_id)),
    )
    if (cookIds.length === 0) {
      setStories([])
      setError(null)
      setIsLoading(false)
      return
    }

    const { data: cooks, error: cooksError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', cookIds)
      .eq('role', 'cook')
      .eq('suspended', false)

    if (cooksError) throw cooksError
    const cookById = new Map((cooks ?? []).map((cook) => [cook.id, cook]))
    setStories(
      (rows ?? [])
        .filter((story) => cookById.has(story.cook_id))
        .map((story) => ({
          ...story,
          cook: cookById.get(story.cook_id)!,
        })),
    )
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const load = () => {
      refresh().catch(() => {
        if (mounted) {
          setError('Stories are temporarily unavailable.')
          setIsLoading(false)
        }
      })
    }
    const channel = supabase
      .channel('discovery-story-highlights')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        load,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (mounted) {
            setError('Live story updates are unavailable. Try refreshing.')
            setIsLoading(false)
          }
        }
      })

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  const activeStory =
    activeIndex === null ? null : (stories[activeIndex] ?? null)
  const moveStory = (step: number) => {
    setActiveIndex((index) => {
      if (index === null || stories.length === 0) return null
      return (index + step + stories.length) % stories.length
    })
  }

  return (
    <>
      <section
        aria-label="Recent cook stories"
        className="relative z-10 shrink-0 px-4 pb-2"
      >
        {isLoading ? (
          <div
            className="flex h-[4.75rem] items-center gap-2 text-xs text-[var(--text-3)]"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Loading fresh stories…
          </div>
        ) : error ? (
          <div className="flex h-[4.75rem] items-center gap-2 text-xs text-[var(--danger)]">
            <span>{error}</span>
            <button className="underline" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : stories.length === 0 ? (
          <p className="flex h-[4.75rem] items-center text-xs text-[var(--text-3)]">
            No fresh cook stories yet.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto py-1 scrollbar-hide">
            {stories.map((story, index) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`View ${story.cook.full_name ?? 'cook'}'s story`}
                className="group flex w-14 shrink-0 flex-col items-center gap-1 text-center"
              >
                <span className="h-12 w-12 rounded-full bg-gradient-to-br from-[var(--accent)] via-amber-400 to-emerald-500 p-[2px] transition-transform group-hover:scale-105">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[var(--bg)] bg-[var(--card)] text-sm font-bold text-[var(--accent)]">
                    {story.cook.avatar_url ? (
                      <img
                        src={story.cook.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (story.cook.full_name?.slice(0, 1).toUpperCase() ?? 'C')
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-[10px] text-[var(--text-2)]">
                  {story.cook.full_name ?? 'Cook'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {activeStory && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setActiveIndex(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${activeStory.cook.full_name ?? 'Cook'}'s story`}
            className="relative flex h-[min(78dvh,44rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 text-white">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-bold">
                {activeStory.cook.avatar_url ? (
                  <img
                    src={activeStory.cook.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (activeStory.cook.full_name?.slice(0, 1).toUpperCase() ?? 'C')
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {activeStory.cook.full_name ?? 'Cook'}
              </span>
              <button
                type="button"
                aria-label="Close story"
                onClick={() => setActiveIndex(null)}
                className="rounded-full bg-black/30 p-2 hover:bg-black/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeStory.video_url ? (
              <video
                key={activeStory.id}
                src={activeStory.video_url}
                autoPlay
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : activeStory.image_url ? (
              <img
                src={activeStory.image_url}
                alt={
                  activeStory.caption || `${activeStory.cook.full_name}'s story`
                }
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white">
                Story media is unavailable.
              </div>
            )}

            {stories.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous story"
                  onClick={() => moveStory(-1)}
                  className="absolute left-3 top-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next story"
                  onClick={() => moveStory(1)}
                  className="absolute right-3 top-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {activeStory.caption && (
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-5 pt-12 text-sm text-white">
                {activeStory.caption}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}
