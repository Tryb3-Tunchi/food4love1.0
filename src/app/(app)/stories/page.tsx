'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BookmarkCheck, Check, Film, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useStories, type OwnedStory } from '@/hooks/useStories'
import { Skeleton } from '@/components/ui/Skeleton'

function formatExpiry(value: string) {
  return new Date(value).toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StoryCard({
  story,
  saving,
  onSave,
}: {
  story: OwnedStory
  saving: boolean
  onSave: (id: string) => void
}) {
  const expired = new Date(story.expires_at).getTime() <= Date.now()

  return (
    <article className="f4l-card flex items-center gap-3 p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
        {story.video_url ? (
          <video
            src={story.video_url}
            preload="metadata"
            className="h-full w-full object-cover"
            aria-label={story.caption || 'Your story video'}
          />
        ) : story.image_url ? (
          <img
            src={story.image_url}
            alt={story.caption || 'Your story'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ color: 'var(--text-3)' }}
          >
            <Film className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`f4l-badge ${expired ? 'f4l-badge-muted' : 'f4l-badge-success'}`}
          >
            {expired ? 'Expired' : 'Live'}
          </span>
          {story.savedAsPost && (
            <span className="f4l-badge f4l-badge-accent">
              <Check className="h-3 w-3" />
              On your profile
            </span>
          )}
        </div>
        <p
          className="line-clamp-2 text-sm font-medium"
          style={{ color: 'var(--text-1)' }}
        >
          {story.caption || 'Story without a caption'}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
          {expired ? 'Ended' : 'Ends'} {formatExpiry(story.expires_at)}
        </p>
      </div>

      {!story.savedAsPost && (
        <button
          type="button"
          onClick={() => onSave(story.id)}
          disabled={saving}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <BookmarkCheck className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save to posts'}
        </button>
      )}
    </article>
  )
}

export default function StoriesPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const { ownedStories, isLoadingOwnedStories, saveStory } = useStories(
    profile?.id ?? null,
  )
  const [savingStoryId, setSavingStoryId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!profile) router.replace('/login')
    else if (profile.role !== 'cook') router.replace('/swipe')
  }, [authLoading, profile, router])

  const handleSave = async (storyId: string) => {
    setSavingStoryId(storyId)
    try {
      const result = await saveStory(storyId)
      toast.success(
        result.alreadySaved
          ? 'This story is already in your posts.'
          : 'Saved to your profile posts.',
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save this story.',
      )
    } finally {
      setSavingStoryId(null)
    }
  }

  const now = Date.now()
  const live = ownedStories.filter(
    (s) => new Date(s.expires_at).getTime() > now,
  )
  const earlier = ownedStories.filter(
    (s) => new Date(s.expires_at).getTime() <= now,
  )

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div
        data-tour="story-management"
        className="bg-[var(--bg)]/80 sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Stories
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Stories last 24 hours. Save one to keep it on your profile.
          </p>
        </div>
        <Link
          data-tour="story-create"
          href="/stories/new"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{
            background: 'var(--accent)',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      <div className="space-y-6 p-4">
        {isLoadingOwnedStories ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : ownedStories.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-soft)' }}
            >
              <Film className="h-7 w-7" style={{ color: 'var(--accent)' }} />
            </div>
            <h2
              className="text-lg font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              No stories yet
            </h2>
            <p
              className="mt-1 max-w-xs text-sm"
              style={{ color: 'var(--text-3)' }}
            >
              Show what is cooking right now. A short video or photo helps
              buyers trust your kitchen.
            </p>
            <Link
              href="/stories/new"
              className="mt-5 rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{
                background: 'var(--accent)',
                boxShadow: 'var(--shadow-warm)',
              }}
            >
              Post your first story
            </Link>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section>
                <p className="f4l-section-label mb-3">Live now</p>
                <div className="space-y-3">
                  {live.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      saving={savingStoryId === story.id}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              </section>
            )}
            {earlier.length > 0 && (
              <section>
                <p className="f4l-section-label mb-3">Earlier</p>
                <div className="space-y-3">
                  {earlier.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      saving={savingStoryId === story.id}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
