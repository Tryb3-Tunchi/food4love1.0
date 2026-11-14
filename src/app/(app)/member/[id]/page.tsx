import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BadgeCheck, MapPin, MessageCircle, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/profileLinks'
import { memberAccess } from '@/lib/matching/access'
import { adultStates } from '@/lib/adultCheck'
import { generalArea } from '@/lib/discovery/geo'
import { BackLink } from '@/components/matching/BackLink'
import { LikeBackButton } from '@/components/matching/LikeBackButton'
import { ReportButton } from '@/components/reports/ReportButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Member profile — Food4Love' }

// A food lover's profile, opened from a conversation, a match, a like or the map.
// It is checked on the server every time: there must be a real relationship (a
// match, a like, or the person opted in to the map). Only these columns are read;
// never email, exact location, coordinates, KYC or notification settings.
const MEMBER_FIELDS =
  'id, full_name, avatar_url, role, bio, location, cuisines, photos, is_verified, suspended, onboarding_complete, created_at'

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { from?: string | string[] }
}) {
  if (!isUuid(params.id)) notFound()

  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) redirect('/login')
  if (user.id === params.id) redirect('/profile')

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('profiles')
    .select(MEMBER_FIELDS)
    .eq('id', params.id)
    .maybeSingle()
  if (!member) notFound()
  if (member.role === 'cook' && !member.suspended) {
    const from = Array.isArray(searchParams.from)
      ? searchParams.from[0]
      : searchParams.from
    redirect(
      `/cook/${member.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`,
    )
  }

  // Only confirmed adults may view other members' profiles.
  const adults = await adultStates(admin, [user.id])
  if (adults.get(user.id) === 'required') notFound()

  const pair = `and(user1_id.eq.${user.id},user2_id.eq.${member.id}),and(user1_id.eq.${member.id},user2_id.eq.${user.id})`
  const [matchResult, swipeResult, discoveryResult] = await Promise.all([
    admin
      .from('matches')
      .select('id')
      .eq('status', 'matched')
      .or(pair)
      .order('created_at', { ascending: true })
      .limit(1),
    admin
      .from('swipes')
      .select('swiper_id, action')
      .in('action', ['like', 'superlike'])
      .or(
        `and(swiper_id.eq.${user.id},swiped_id.eq.${member.id}),and(swiper_id.eq.${member.id},swiped_id.eq.${user.id})`,
      ),
    // Before the discovery migration is applied this table does not exist; that
    // simply means nobody is discoverable yet, so the error is treated as "no".
    admin
      .from('member_discovery')
      .select('discoverable')
      .eq('user_id', member.id)
      .maybeSingle(),
  ])

  const matchId = matchResult.data?.[0]?.id ?? null
  const likes = swipeResult.data ?? []
  const likedMe = likes.some((l) => l.swiper_id === member.id)

  const access = memberAccess({
    viewerId: user.id,
    targetId: member.id,
    targetRole: member.role,
    targetSuspended: member.suspended,
    targetOnboarded: member.onboarding_complete,
    matched: !!matchId,
    likeRelationship: likes.length > 0,
    discoverable: discoveryResult.data?.discoverable === true,
  })
  if (!access.allowed) notFound()

  const name = member.full_name || 'Food4Love member'
  const photos = ((member.photos ?? []) as string[]).filter(Boolean).slice(0, 5)
  const area = generalArea(member.location)
  const since = member.created_at
    ? new Date(member.created_at).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
      <BackLink from={searchParams.from} />

      <div
        className="mt-2 overflow-hidden rounded-3xl"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--divider)',
        }}
      >
        {photos.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto">
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`${name}, photo ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="h-72 w-full shrink-0 snap-center object-cover sm:h-80"
              />
            ))}
          </div>
        ) : (
          <div
            className="flex h-56 items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}
          >
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar_url}
                alt={name}
                className="h-40 w-40 rounded-full object-cover"
              />
            ) : (
              <UserRound
                className="h-16 w-16"
                style={{ color: 'var(--accent)' }}
                aria-hidden="true"
              />
            )}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="flex items-center gap-2 font-heading text-2xl font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                <span className="truncate">{name}</span>
                {member.is_verified && (
                  <BadgeCheck
                    className="h-5 w-5 shrink-0"
                    style={{ color: 'var(--success)' }}
                    aria-label="Verified member"
                  />
                )}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--accent)' }}>
                Food lover
              </p>
            </div>
            <ReportButton targetType="profile" targetId={member.id} />
          </div>

          {area && (
            <p
              className="mt-3 flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--text-3)' }}
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {area}
            </p>
          )}

          {member.bio && (
            <p
              className="mt-4 whitespace-pre-line text-sm leading-relaxed"
              style={{ color: 'var(--text-2)' }}
            >
              {member.bio}
            </p>
          )}

          {member.cuisines?.length > 0 && (
            <div className="mt-4">
              <p className="f4l-section-label mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {(member.cuisines as string[]).map((c) => (
                  <span key={c} className="f4l-badge f4l-badge-muted">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {since && (
            <p className="mt-4 text-xs" style={{ color: 'var(--text-3)' }}>
              On Food4Love since {since}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {matchId && (
          <Link
            href={`/chat/${matchId}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-bold text-white"
            style={{ background: 'var(--bubble-own)' }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Message {name.split(' ')[0]}
          </Link>
        )}
        {!matchId && likedMe && (
          <LikeBackButton personId={member.id} name={name.split(' ')[0]} />
        )}
      </div>
    </main>
  )
}
