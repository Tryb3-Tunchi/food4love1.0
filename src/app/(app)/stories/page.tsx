'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict } from 'date-fns'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { BookmarkCheck, Camera, ChevronRight, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useStories } from '@/hooks/useStories'
import { getInitials } from '@/lib/utils'
import { RingFrame } from '@/components/stories/StoryRing'
import {
  StoryViewer,
  type StoryViewerActions,
} from '@/components/stories/StoryViewer'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Story } from '@/types/db'

type Viewing =
  | { kind: 'mine' }
  | { kind: 'chef'; cookId: string }
  | { kind: 'past'; storyId: string }
  | null

function Dp({
  url,
  name,
  size,
}: {
  url?: string | null
  name?: string | null
  size: number
}) {
  return (
    <span
      className="flex items-center justify-center overflow-hidden rounded-full text-sm font-bold"
      style={{
        width: size,
        height: size,
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
      }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name ?? 'Chef')
      )}
    </span>
  )
}

const byOldest = (a: Story, b: Story) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

export default function StoriesPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const {
    stories,
    ownedStories,
    isLoadingOwnedStories,
    saveStory,
    deleteStory,
  } = useStories(profile?.id ?? null)
  const [viewing, setViewing] = useState<Viewing>(null)

  useEffect(() => {
    if (authLoading) return
    if (!profile) router.replace('/login')
    else if (profile.role !== 'cook') router.replace('/swipe')
  }, [authLoading, profile, router])

  const now = Date.now()
  const mineLive = ownedStories
    .filter((s) => new Date(s.expires_at).getTime() > now)
    .sort(byOldest)
  const past = ownedStories
    .filter((s) => new Date(s.expires_at).getTime() <= now)
    .sort((a, b) => byOldest(b, a))

  const chefs = useMemo(() => {
    const groups = new Map<
      string,
      { cookId: string; name: string; avatar: string | null; items: Story[] }
    >()
    for (const story of stories) {
      if (story.cook_id === profile?.id) continue
      const group = groups.get(story.cook_id) ?? {
        cookId: story.cook_id,
        name: story.cook?.full_name ?? 'Chef',
        avatar: story.cook?.avatar_url ?? null,
        items: [],
      }
      group.items.push(story)
      groups.set(story.cook_id, group)
    }
    return Array.from(groups.values())
      .map((g) => ({ ...g, items: g.items.sort(byOldest) }))
      .sort(
        (a, b) =>
          new Date(b.items[b.items.length - 1].created_at).getTime() -
          new Date(a.items[a.items.length - 1].created_at).getTime(),
      )
  }, [stories, profile?.id])

  const handleSave = async (story: Story) => {
    try {
      const result = await saveStory(story.id)
      toast.success(
        result.alreadySaved
          ? 'This story is already on your profile.'
          : 'Saved to your profile posts.',
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save this story.',
      )
    }
  }

  const handleDelete = async (story: Story) => {
    try {
      await deleteStory(story.id)
      toast.success('Story deleted')
    } catch {
      toast.error('Could not delete this story.')
    }
  }

  const ownActions: StoryViewerActions = {
    onSave: handleSave,
    onDelete: handleDelete,
    isSaved: (story) =>
      ownedStories.find((s) => s.id === story.id)?.savedAsPost ?? false,
  }

  const viewer = (() => {
    if (!viewing || !profile) return null
    const me = {
      name: profile.full_name ?? 'You',
      avatarUrl: profile.avatar_url,
    }
    if (viewing.kind === 'mine') {
      return { stories: mineLive, author: me, actions: ownActions }
    }
    if (viewing.kind === 'past') {
      const story = past.find((s) => s.id === viewing.storyId)
      return story
        ? { stories: [story], author: me, actions: ownActions }
        : null
    }
    const chef = chefs.find((c) => c.cookId === viewing.cookId)
    return chef
      ? {
          stories: chef.items,
          author: { name: chef.name, avatarUrl: chef.avatar },
          actions: undefined,
        }
      : null
  })()

  const soonest = mineLive.length
    ? mineLive.reduce((a, b) =>
        new Date(a.expires_at) < new Date(b.expires_at) ? a : b,
      )
    : null

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-44">
      <div
        data-tour="story-management"
        className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Stories
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Show what is cooking. Stories disappear after 24 hours.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-7 px-4 pt-5">
        {/* My story */}
        <section>
          {isLoadingOwnedStories ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : (
            <div className="f4l-card flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() =>
                  mineLive.length
                    ? setViewing({ kind: 'mine' })
                    : router.push('/stories/new')
                }
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
              >
                <span className="relative shrink-0">
                  <RingFrame
                    count={mineLive.length}
                    gapColor="var(--card)"
                    className="m-[7px]"
                  >
                    <Dp
                      url={profile?.avatar_url}
                      name={profile?.full_name}
                      size={56}
                    />
                  </RingFrame>
                  {mineLive.length === 0 && (
                    <span
                      className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 text-white"
                      style={{
                        background: 'var(--accent)',
                        borderColor: 'var(--card)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-base font-semibold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    My story
                  </span>
                  <span
                    className="block truncate text-sm"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {soonest
                      ? `${mineLive.length} live · ends in ${formatDistanceToNowStrict(new Date(soonest.expires_at))}`
                      : 'Tap to share what you are cooking'}
                  </span>
                </span>
              </button>
              <Link
                href="/stories/new"
                aria-label="Add to your story"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <Camera className="h-5 w-5" />
              </Link>
            </div>
          )}
        </section>

        {/* Other chefs */}
        <section>
          <p className="f4l-section-label mb-3">Recent updates</p>
          {chefs.length === 0 ? (
            <div className="f4l-card p-4">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                No other chefs have a story up right now. Be the first to post
                today.
              </p>
            </div>
          ) : (
            <div className="f4l-card divide-y divide-[var(--divider)]">
              {chefs.map((chef) => (
                <button
                  key={chef.cookId}
                  type="button"
                  onClick={() =>
                    setViewing({ kind: 'chef', cookId: chef.cookId })
                  }
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <RingFrame
                    count={chef.items.length}
                    gapColor="var(--card)"
                    className="m-[7px] shrink-0"
                  >
                    <Dp url={chef.avatar} name={chef.name} size={52} />
                  </RingFrame>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {chef.name}
                    </span>
                    <span
                      className="block text-xs"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {formatDistanceToNowStrict(
                        new Date(chef.items[chef.items.length - 1].created_at),
                        { addSuffix: true },
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--text-3)' }}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Past stories */}
        {past.length > 0 && (
          <section>
            <p className="f4l-section-label mb-3">Your past stories</p>
            <div className="grid grid-cols-3 gap-2">
              {past.map((story) => {
                const saved =
                  ownedStories.find((s) => s.id === story.id)?.savedAsPost ??
                  false
                return (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() =>
                      setViewing({ kind: 'past', storyId: story.id })
                    }
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black"
                    aria-label={story.caption || 'Past story'}
                  >
                    {story.image_url ? (
                      <img
                        src={story.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={story.video_url ?? undefined}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    {saved && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[var(--accent)]">
                        <BookmarkCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 p-2 text-left text-[11px] font-semibold text-white">
                      {new Date(story.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.2 }}
        className="fixed bottom-[6.5rem] right-4 z-40"
      >
        <Link
          data-tour="story-create"
          href="/stories/new"
          aria-label="Post a story"
          className="flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform active:scale-90"
          style={{
            background: 'linear-gradient(135deg, #ff9a52, var(--accent))',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          <Camera className="h-6 w-6" />
        </Link>
      </motion.div>

      {viewer && (
        <StoryViewer
          stories={viewer.stories}
          author={viewer.author}
          actions={viewer.actions}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
