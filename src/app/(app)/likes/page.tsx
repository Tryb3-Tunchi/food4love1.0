'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Heart, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

export default function LikesPage() {
  const { profile } = useAuthStore()

  const { data: likes, isLoading } = useQuery({
    queryKey: ['my-likes'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('swipes')
        .select(
          `
          *,
          swiped:profiles!swipes_swiped_id_fkey(id, full_name, avatar_url, bio, cuisines, price_min, price_max)
        `,
        )
        .eq('swiper_id', profile!.id)
        .eq('action', 'like')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!likes || likes.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-12 w-12" />}
        title="No likes yet"
        description="Chefs you like will appear here. Start discovering!"
        action={{ label: 'Discover Chefs', href: '/swipe' }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold">Liked Chefs</h1>
        <p className="text-sm text-[var(--text-muted)]">{likes.length} saved</p>
      </div>

      <div className="space-y-3 p-4">
        {likes.map((like, idx) => (
          <motion.div
            key={like.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              href={`/cook/${like.swiped_id}`}
              className="hover:border-[var(--primary)]/30 group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors"
            >
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--bg-2)]">
                {like.swiped?.avatar_url ? (
                  <Image
                    src={like.swiped.avatar_url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    👨‍🍳
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">
                  {like.swiped?.full_name}
                </h3>
                <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                  {like.swiped?.cuisines?.join(', ') || 'Various cuisines'}
                </p>
                {like.swiped?.price_min && (
                  <p className="mt-0.5 text-xs font-medium text-[var(--primary)]">
                    ₦{like.swiped.price_min.toLocaleString()}+
                  </p>
                )}
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--primary)]" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
