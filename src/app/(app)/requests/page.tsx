'use client'
import { useMatches } from '@/hooks/useMatches'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AppPage } from '@/components/ui/AppPage'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import { ChefHat, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

export default function RequestsPage() {
  const profile = useAuthStore((s) => s.profile)
  const { data: matches, isLoading } = useMatches()

  const isUnverified =
    profile?.role === 'cook' && profile?.kyc_status !== 'verified'

  return (
    <AppPage ambient="pepper" ambientIntensity="low" className="px-4 pb-6 pt-6">
      <PageHeader title="Requests" icon={ChefHat} />

      {isUnverified && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 rounded-2xl p-4"
          style={{
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          }}
        >
          <Shield
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: 'var(--warning)' }}
          />
          <div className="flex-1">
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--warning)' }}
            >
              KYC verification pending
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
              You can chat with matches but cannot accept bookings until
              verified.
            </p>
            {profile?.kyc_status !== 'pending' && (
              <Link
                href="/onboarding/kyc"
                className="mt-2 inline-block text-xs font-semibold underline"
                style={{ color: 'var(--accent)' }}
              >
                Complete verification →
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Loading...
        </p>
      ) : !matches?.length ? (
        <EmptyState
          icon="🍳"
          title="No requests yet"
          description="Food lovers will appear here when they match with you."
        />
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => {
            const buyer = m.other_user
            if (!buyer) return null
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/chat/${m.id}`}
                  className="app-card group flex items-center gap-3 rounded-2xl p-4 transition-all duration-150 active:scale-[0.99]"
                >
                  <Avatar
                    src={buyer.avatar_url}
                    name={buyer.full_name}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {buyer.full_name}
                    </span>
                    <p
                      className="truncate text-sm"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {m.last_message?.content ?? 'Wants to connect 👋'}
                    </p>
                  </div>
                  {m.unread_count ? (
                    <Badge
                      variant="default"
                      size="sm"
                      className="shrink-0 border-0 text-white"
                      style={
                        { background: 'var(--accent)' } as React.CSSProperties
                      }
                    >
                      {m.unread_count}
                    </Badge>
                  ) : null}
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </AppPage>
  )
}
