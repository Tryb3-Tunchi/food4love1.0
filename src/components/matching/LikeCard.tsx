'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Clock, Heart, MessageCircle, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { LikeBackButton } from '@/components/matching/LikeBackButton'
import { profileHref } from '@/lib/profileLinks'
import type { LikeItem } from '@/services/likes'

const STATE_LABEL: Record<LikeItem['state'], string> = {
  pending: 'Liked you',
  passed: 'You passed',
  matched: "It's a match",
  waiting: 'Waiting for a reply',
}

// One person who liked you (kind="received") or whom you liked (kind="sent").
// The photo and the name both open their real profile, with a way back.
export function LikeCard({
  item,
  kind,
  returnTo,
}: {
  item: LikeItem
  kind: 'received' | 'sent'
  returnTo: string
}) {
  const { person } = item
  const name = person.full_name || 'Food4Love member'
  const href = profileHref(person, returnTo)
  const when = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
  })
  const avatar = (
    <Avatar
      src={person.avatar_url}
      name={name}
      size="lg"
      verified={!!person.is_verified}
    />
  )

  return (
    <div className="app-card flex flex-wrap items-center gap-3 rounded-2xl p-4">
      {href ? (
        <Link
          href={href}
          aria-label={`View ${name}'s profile`}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {avatar}
        </Link>
      ) : (
        avatar
      )}

      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="block truncate text-sm font-bold hover:underline"
            style={{ color: 'var(--text-1)' }}
          >
            {name}
          </Link>
        ) : (
          <span
            className="block truncate text-sm font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            {name}
          </span>
        )}
        <p
          className="mt-0.5 flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-2)' }}
        >
          {item.superlike ? (
            <Star className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Heart className="h-3 w-3" aria-hidden="true" />
          )}
          {kind === 'received' && item.state === 'pending' && item.superlike
            ? 'Super-liked you'
            : STATE_LABEL[item.state]}
        </p>
        <p
          className="mt-0.5 flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--text-3)' }}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {when}
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold sm:flex-none"
            style={{ borderColor: 'var(--divider)', color: 'var(--text-1)' }}
          >
            View profile
          </Link>
        )}
        {item.state === 'matched' && item.match_id && (
          <Link
            href={`/chat/${item.match_id}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white sm:flex-none"
            style={{ background: 'var(--bubble-own)' }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Message
          </Link>
        )}
        {kind === 'received' && item.state === 'pending' && (
          <LikeBackButton personId={person.id} name={name} />
        )}
      </div>
    </div>
  )
}
