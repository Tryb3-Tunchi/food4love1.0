'use client'
import { useMatches } from '@/hooks/useMatches'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { ChefHat, Shield } from 'lucide-react'

export default function RequestsPage() {
  const profile = useAuthStore((s) => s.profile)
  const { data: matches, isLoading } = useMatches()

  const isUnverified =
    profile?.role === 'cook' && profile?.kyc_status !== 'verified'

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center gap-2">
        <ChefHat className="h-5 w-5 text-ember" />
        <h1 className="text-xl font-bold text-white">Requests</h1>
      </div>

      {isUnverified && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-400">
              KYC verification pending
            </p>
            <p className="mt-0.5 text-xs text-mist">
              You can chat with matches but cannot accept bookings until
              verified.
            </p>
            {profile?.kyc_status !== 'pending' && (
              <Link
                href="/onboarding/kyc"
                className="mt-2 inline-block text-xs text-pepper underline"
              >
                Complete verification →
              </Link>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-mist">Loading...</p>
      ) : !matches?.length ? (
        <EmptyState
          icon="🍳"
          title="No requests yet"
          description="Food lovers will appear here when they match with you."
        />
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const buyer = m.other_user
            if (!buyer) return null
            return (
              <Link
                key={m.id}
                href={`/chat/${m.id}`}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-smoke p-4 transition-all hover:border-ember/20"
              >
                <Avatar
                  src={buyer.avatar_url}
                  name={buyer.full_name}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {buyer.full_name}
                  </span>
                  <p className="truncate text-sm text-mist">
                    {m.last_message?.content ?? 'Wants to connect 👋'}
                  </p>
                </div>
                {m.unread_count ? (
                  <Badge
                    variant="default"
                    size="sm"
                    className="shrink-0 border-0 bg-pepper text-white"
                  >
                    {m.unread_count}
                  </Badge>
                ) : null}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
