'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Heart,
  X,
  CheckCircle,
  MessageCircle,
  Loader2,
  User,
  Calendar,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface SwipeRecord {
  id: string
  swiper_id: string
  swiped_id: string
  action: string
  created_at: string
  swiper: { full_name: string; avatar_url: string | null; role: string } | null
  swiped: { full_name: string; avatar_url: string | null; role: string } | null
}

export default function AdminSwipesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'like' | 'superlike' | 'pass'>(
    'all',
  )

  const { data: swipes = [], isLoading } = useQuery({
    queryKey: ['admin-swipes', filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('action', filter)
      const response = await fetch(`/api/admin/swipes?${params.toString()}`, {
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load swipe activity')
      return (result.swipes ?? []) as SwipeRecord[]
    },
  })

  const createMatchMutation = useMutation({
    mutationFn: async ({ user1, user2 }: { user1: string; user2: string }) => {
      const reason = window.prompt('Reason for creating this match:')
      if (!reason?.trim()) throw new Error('A reason is required')
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          user1_id: user1,
          user2_id: user2,
          reason: reason.trim(),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(result.error || 'Could not create match')
    },
    onSuccess: () => {
      toast.success('Match created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-swipes'] })
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Could not create match')
    },
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8390E]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0A05] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Swipe Activity</h1>
            <p className="text-sm text-white/50">
              Monitor and manage user swipes
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', 'like', 'superlike', 'pass'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-[#E8390E] text-white'
                    : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {swipes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/60">No swipes found</p>
            </div>
          ) : (
            swipes.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                {/* Swiper */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {s.swiper?.avatar_url ? (
                      <img
                        src={s.swiper.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-white/40" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {s.swiper?.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs capitalize text-white/40">
                      {s.swiper?.role}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex flex-col items-center px-4">
                  {s.action === 'like' && (
                    <Heart className="h-5 w-5 text-[#84CC16]" />
                  )}
                  {s.action === 'superlike' && (
                    <Heart className="h-5 w-5 fill-[#3B82F6] text-[#3B82F6]" />
                  )}
                  {s.action === 'pass' && (
                    <X className="h-5 w-5 text-red-500" />
                  )}
                  <span className="mt-1 text-[10px] uppercase text-white/30">
                    {s.action}
                  </span>
                </div>

                {/* Swiped */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {s.swiped?.avatar_url ? (
                      <img
                        src={s.swiped.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-white/40" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {s.swiped?.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs capitalize text-white/40">
                      {s.swiped?.role}
                    </p>
                  </div>
                </div>

                {/* Date */}
                <div className="hidden items-center gap-1 text-xs text-white/30 md:flex">
                  <Calendar className="h-3 w-3" />
                  {new Date(s.created_at).toLocaleDateString('en-NG')}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      createMatchMutation.mutate({
                        user1: s.swiper_id,
                        user2: s.swiped_id,
                      })
                    }}
                    disabled={createMatchMutation.isPending}
                    className="flex items-center gap-1 rounded-full bg-[#84CC16]/10 px-3 py-1.5 text-xs font-medium text-[#84CC16] hover:bg-[#84CC16]/20 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Match
                  </button>
                  <button
                    onClick={() => router.push('/admin/users')}
                    className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Users
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
