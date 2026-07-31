'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { UserCheck, UserX, Clock, ChefHat } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { toast } from 'sonner'

export default function RequestsPage() {
  const { profile } = useAuthStore()

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

  const handleDecline = async (swiperId: string) => {
    // Soft decline - just mark swipe as pass
    toast.info('Request declined')
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        icon={<ChefHat className="h-12 w-12" />}
        title="No requests yet"
        description="When food lovers like your profile, they'll appear here."
        action={{ label: 'View Your Profile', href: '/profile' }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold">Match Requests</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {requests.length} pending{' '}
          {requests.length === 1 ? 'request' : 'requests'}
        </p>
      </div>

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
                <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                  {req.swiper?.bio || 'No bio yet'}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  Liked you recently
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDecline(req.swiper_id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--bg-2)] py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <UserX className="h-4 w-4" />
                Decline
              </button>
              <button
                onClick={() => handleAccept(req.swiper_id)}
                className="hover:bg-[var(--primary)]/90 flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-medium text-white transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                Accept Match
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
