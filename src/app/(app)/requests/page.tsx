'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  UserCheck,
  UserX,
  Clock,
  ChefHat,
  MessageCircle,
  Film,
  BookmarkCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { toast } from 'sonner'
import { useStories } from '@/hooks/useStories'
import { useState } from 'react'

function DashboardActions() {
  return (
    <div className="flex gap-2 px-4 pb-3">
      <Link
        href="/chat"
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-2)]"
      >
        <MessageCircle className="h-4 w-4" />
        Chats
      </Link>
      <Link
        href="/stories/new"
        className="hover:bg-[var(--accent)]/90 flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-colors"
      >
        <Film className="h-4 w-4" />
        Post a story
      </Link>
    </div>
  )
}

export default function RequestsPage() {
  const { profile } = useAuthStore()
  const { ownedStories, isLoadingOwnedStories, saveStory } = useStories(
    profile?.id ?? null,
  )
  const [savingStoryId, setSavingStoryId] = useState<string | null>(null)

  const {
    data: requests,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['match-requests'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('swipes')
        .select(
          `
          *,
          swiper:profiles!swipes_swiper_id_fkey(id, full_name, avatar_url, bio)
        `,
        )
        .eq('swiped_id', profile!.id)
        .eq('action', 'like')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  const handleAccept = async (swiperId: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('matches').insert({
      user1_id: swiperId,
      user2_id: profile!.id,
      status: 'matched',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) toast.error('Failed to accept')
    else {
      toast.success('Match accepted! Start chatting.')
      refetch()
    }
  }

  const handleDecline = async () => {
    // Soft decline - just mark swipe as pass
    toast.info('Request declined')
  }

  const handleSaveStory = async (storyId: string) => {
    setSavingStoryId(storyId)
    try {
      const result = await saveStory(storyId)
      toast.success(
        result.alreadySaved
          ? 'This story is already in your posts.'
          : 'Saved to posts.',
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save this story.',
      )
    } finally {
      setSavingStoryId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] backdrop-blur-xl">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold">Match Requests</h1>
          <p className="text-sm text-[var(--text-3)]">
            {isLoading
              ? 'Loading...'
              : `${requests?.length ?? 0} pending ${requests?.length === 1 ? 'request' : 'requests'}`}
          </p>
        </div>
        <DashboardActions />
      </div>

      {profile?.role === 'cook' && (
        <section
          data-tour="story-management"
          className="border-b border-[var(--border)] px-4 py-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Your stories</h2>
              <p className="text-xs text-[var(--text-3)]">
                Stories expire after 24 hours. Saved posts stay on your profile.
              </p>
            </div>
            <Link
              data-tour="story-create"
              href="/stories/new"
              className="shrink-0 text-sm font-semibold text-[var(--accent)]"
            >
              Post story
            </Link>
          </div>
          {isLoadingOwnedStories ? (
            <p className="py-5 text-sm text-[var(--text-3)]">
              Loading stories…
            </p>
          ) : ownedStories.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--text-3)]">
              You have not posted a story yet.
            </div>
          ) : (
            <div className="space-y-3">
              {ownedStories.map((story) => {
                const expired =
                  new Date(story.expires_at).getTime() <= Date.now()
                const isSaving = savingStoryId === story.id

                return (
                  <article
                    key={story.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
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
                        <div className="flex h-full items-center justify-center text-[var(--text-3)]">
                          <Film className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {story.caption || 'Story without a caption'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-3)]">
                        {expired ? 'Expired' : 'Expires'} ·{' '}
                        {new Date(story.expires_at).toLocaleString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveStory(story.id)}
                      disabled={story.savedAsPost || isSaving}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <BookmarkCheck className="h-4 w-4" />
                      {isSaving
                        ? 'Saving…'
                        : story.savedAsPost
                          ? 'Saved'
                          : 'Save to posts'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {isLoading ? (
        <div className="space-y-4 p-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <EmptyState
          icon={<ChefHat className="h-12 w-12" />}
          title="No requests yet"
          description="When food lovers like your profile, they'll appear here."
          action={{ label: 'View Your Profile', href: '/profile' }}
        />
      ) : (
        <div className="space-y-3 p-4">
          {requests.map((req, idx) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)]">
                  {req.swiper?.avatar_url ? (
                    <Image
                      src={req.swiper.avatar_url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-2)] text-2xl">
                      👤
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">
                    {req.swiper?.full_name || 'Food Lover'}
                  </h3>
                  <p className="line-clamp-1 text-xs text-[var(--text-3)]">
                    {req.swiper?.bio || 'No bio yet'}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                    <Clock className="h-3 w-3" />
                    Liked you recently
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--bg-2)] py-2.5 text-sm font-medium text-[var(--text-3)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <UserX className="h-4 w-4" />
                  Decline
                </button>
                <button
                  onClick={() => handleAccept(req.swiper_id)}
                  className="hover:bg-[var(--accent)]/90 flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  Accept Match
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
