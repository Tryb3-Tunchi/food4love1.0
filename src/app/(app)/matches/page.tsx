'use client'
import { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Heart,
  Clock,
  MessageCircle,
  Bell,
  Inbox,
  Send,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useMatches, type MatchListItem } from '@/hooks/useMatches'
import { useLikes } from '@/hooks/useLikes'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AppPage } from '@/components/ui/AppPage'
import { PageHeader } from '@/components/ui/PageHeader'
import { LikeCard } from '@/components/matching/LikeCard'
import { profileHref } from '@/lib/profileLinks'
import { buildActivity } from '@/lib/matching/activity'

type Tab = 'matches' | 'received' | 'sent' | 'activity'
const TABS: { id: Tab; label: string; icon: typeof Heart }[] = [
  { id: 'matches', label: 'Matches', icon: Heart },
  { id: 'received', label: 'Likes received', icon: Inbox },
  { id: 'sent', label: 'Likes sent', icon: Send },
  { id: 'activity', label: 'New activity', icon: Bell },
]

function RowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4"
      style={{ background: 'var(--surface-muted)' }}
    >
      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function ErrorBox({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="px-4 py-16 text-center">
      <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
        {what} could not load
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold text-white"
        style={{ background: 'var(--bubble-own)' }}
      >
        Try again
      </button>
    </div>
  )
}

function Empty({
  title,
  text,
  cta,
}: {
  title: string
  text: string
  cta?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">
        🍽️
      </div>
      <h3 className="mb-2 text-lg font-bold" style={{ color: 'var(--text-1)' }}>
        {title}
      </h3>
      <p
        className="mb-6 max-w-xs text-sm leading-relaxed"
        style={{ color: 'var(--text-3)' }}
      >
        {text}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-8 font-bold text-white transition-all active:scale-95"
          style={{
            background: 'var(--accent)',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}

function MatchCard({ match, index }: { match: MatchListItem; index: number }) {
  const person = match.other_user
  const displayName = person.full_name || 'Food4Love member'
  const href = match.profile_missing
    ? null
    : profileHref(person, '/matches?tab=matches')
  const expiresAt = new Date(match.expires_at)
  const isExpired = expiresAt.getTime() < Date.now()
  const isExpiringSoon =
    !isExpired && expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000
  const avatar = (
    <Avatar
      src={person.avatar_url}
      name={displayName}
      size="lg"
      verified={!!person.is_verified}
    />
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05 }}
    >
      <div className="app-card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {href ? (
              <Link
                href={href}
                aria-label={`View ${displayName}'s profile`}
                className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {avatar}
              </Link>
            ) : (
              avatar
            )}
            {!match.last_message && (
              <span
                className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2"
                style={{
                  background: 'var(--accent)',
                  borderColor: 'var(--app-bg)',
                }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              {href ? (
                <Link
                  href={href}
                  className="truncate text-sm font-bold hover:underline"
                  style={{ color: 'var(--text-1)' }}
                >
                  {displayName}
                </Link>
              ) : (
                <span
                  className="truncate text-sm font-bold"
                  style={{ color: 'var(--text-1)' }}
                >
                  {displayName}
                </span>
              )}
              {match.unread_count ? (
                <span
                  className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'var(--bubble-own)' }}
                >
                  {match.unread_count > 9 ? '9+' : match.unread_count}
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm" style={{ color: 'var(--text-2)' }}>
              {match.last_message?.content ?? (
                <span style={{ color: 'var(--accent)' }}>
                  ✨ New match — say hi!
                </span>
              )}
            </p>
            <p
              className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px]"
              style={{ color: 'var(--text-3)' }}
            >
              <span>
                Matched {format(new Date(match.created_at), 'd MMM yyyy')}
              </span>
              <span
                className="inline-flex items-center gap-1"
                style={{
                  color: isExpiringSoon ? 'var(--accent)' : 'var(--text-3)',
                }}
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                {isExpired
                  ? 'Expired'
                  : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {href && (
            <Link
              href={href}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold"
              style={{ borderColor: 'var(--divider)', color: 'var(--text-1)' }}
            >
              View profile
            </Link>
          )}
          <Link
            href={`/chat/${match.id}`}
            aria-label={`Open conversation with ${displayName}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white"
            style={{ background: 'var(--bubble-own)' }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Message
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function MatchesPanel() {
  const { data: matches, isLoading, error, refetch } = useMatches()
  if (isLoading)
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  if (error)
    return <ErrorBox what="Your matches" onRetry={() => void refetch()} />
  if (!matches?.length)
    return (
      <div data-tour="matches-content">
        <Empty
          title="No matches yet"
          text="When someone likes you back, they appear here. You have 24 hours to start a conversation before it expires."
          cta={{ href: '/swipe', label: 'Start swiping →' }}
        />
      </div>
    )
  return (
    <div data-tour="matches-content" className="space-y-2">
      {matches.map((match, i) => (
        <MatchCard key={match.id} match={match} index={i} />
      ))}
    </div>
  )
}

function LikesPanel({ kind }: { kind: 'received' | 'sent' }) {
  const likes = useLikes(kind)
  const returnTo = `/matches?tab=${kind}`
  // The server works out each like's state; the received tab shows only unanswered likes.
  const visible =
    kind === 'received'
      ? likes.items.filter((i) => i.state === 'pending')
      : likes.items

  if (likes.isLoading)
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  if (likes.error)
    return (
      <ErrorBox
        what={kind === 'received' ? 'Likes received' : 'Likes sent'}
        onRetry={() => void likes.refetch()}
      />
    )
  if (!visible.length)
    return kind === 'received' ? (
      <Empty
        title="No new likes right now"
        text="When someone likes you, they show up here so you can see their profile and like them back."
        cta={{ href: '/swipe', label: 'Keep discovering →' }}
      />
    ) : (
      <Empty
        title="You have not liked anyone yet"
        text="People you like show up here with an accurate status: waiting for a reply, or matched."
        cta={{ href: '/swipe', label: 'Start swiping →' }}
      />
    )
  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <LikeCard
          key={item.person.id}
          item={item}
          kind={kind}
          returnTo={returnTo}
        />
      ))}
      {likes.hasNextPage && (
        <button
          type="button"
          onClick={() => void likes.fetchNextPage()}
          disabled={likes.isFetchingNextPage}
          className="mx-auto flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold disabled:opacity-60"
          style={{ borderColor: 'var(--divider)', color: 'var(--text-1)' }}
        >
          {likes.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function ActivityPanel() {
  const matchesQuery = useMatches()
  const received = useLikes('received')
  const sent = useLikes('sent')

  const events = useMemo(
    () =>
      buildActivity({
        received: received.items.map((i) => ({
          created_at: i.created_at,
          person: i.person,
        })),
        sent: sent.items.map((i) => ({
          created_at: i.created_at,
          person: i.person,
        })),
        matches: (matchesQuery.data ?? []).map((m) => ({
          id: m.id,
          created_at: m.created_at,
          person: {
            id: m.other_user.id,
            role: m.other_user.role ?? '',
            full_name: m.other_user.full_name,
            avatar_url: m.other_user.avatar_url,
          },
        })),
      }),
    [received.items, sent.items, matchesQuery.data],
  )

  if (matchesQuery.isLoading || received.isLoading || sent.isLoading)
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  if (matchesQuery.error || received.error || sent.error)
    return (
      <ErrorBox
        what="Your activity"
        onRetry={() => {
          void matchesQuery.refetch()
          void received.refetch()
          void sent.refetch()
        }}
      />
    )
  if (!events.length)
    return (
      <Empty
        title="Nothing new yet"
        text="Recent likes and matches will show up here as they happen."
      />
    )

  const label = {
    match: 'You matched',
    like_received: 'Liked you',
    like_sent: 'You liked',
  } as const

  return (
    <ul className="space-y-2">
      {events.map((event) => {
        const href = profileHref(event.person, '/matches?tab=activity')
        const name = event.person.full_name || 'Food4Love member'
        const inner = (
          <>
            <Avatar src={event.person.avatar_url} name={name} size="md" />
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: 'var(--text-1)' }}
              >
                {name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                {label[event.kind]} ·{' '}
                {formatDistanceToNow(new Date(event.at), { addSuffix: true })}
              </p>
            </div>
          </>
        )
        return (
          <li key={event.key}>
            {href ? (
              <Link
                href={href}
                className="app-card flex min-h-14 items-center gap-3 rounded-2xl p-3"
              >
                {inner}
              </Link>
            ) : (
              <div className="app-card flex min-h-14 items-center gap-3 rounded-2xl p-3">
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function MatchesTabs() {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = TABS.some((t) => t.id === requested)
    ? (requested as Tab)
    : 'matches'

  const matches = useMatches()
  const received = useLikes('received')
  const sent = useLikes('sent')

  const pendingCount = received.items.filter(
    (i) => i.state === 'pending',
  ).length
  const counts: Partial<Record<Tab, string>> = {
    matches: matches.data ? String(matches.data.length) : undefined,
    received: received.data
      ? `${pendingCount}${received.hasNextPage ? '+' : ''}`
      : undefined,
    // Count what is actually listed (the stored total also includes people who
    // were suspended or deleted since), with a + while more pages exist.
    sent: sent.data
      ? `${sent.items.length}${sent.hasNextPage ? '+' : ''}`
      : undefined,
  }

  return (
    <AppPage ambient="pepper" ambientIntensity="low" className="px-4 pb-6 pt-6">
      <PageHeader
        title="Matches"
        icon={Users}
        iconColor="var(--accent)"
        iconBg="var(--accent-soft)"
      />

      <div
        role="tablist"
        aria-label="Matches and likes"
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() =>
                router.replace(`/matches?tab=${id}`, { scroll: false })
              }
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text-1)',
                borderColor: active ? 'var(--accent)' : 'var(--divider)',
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {counts[id] !== undefined && (
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold"
                  style={{
                    background: active
                      ? 'rgba(255,255,255,0.25)'
                      : 'var(--accent-soft)',
                    color: active ? '#fff' : 'var(--accent)',
                  }}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {tab === 'matches' && <MatchesPanel />}
        {tab === 'received' && <LikesPanel kind="received" />}
        {tab === 'sent' && <LikesPanel kind="sent" />}
        {tab === 'activity' && <ActivityPanel />}
      </div>
    </AppPage>
  )
}

export default function MatchesPage() {
  return (
    <Suspense fallback={null}>
      <MatchesTabs />
    </Suspense>
  )
}
