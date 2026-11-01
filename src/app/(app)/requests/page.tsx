'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Heart, Inbox, Loader2, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  acceptBooking,
  declineBooking,
  getMyBookings,
  type Booking,
} from '@/services/bookings'
import {
  getMatchRequests,
  respondToMatchRequest,
  type MatchRequest,
} from '@/services/cookRequests'
import {
  DECLINE_KEYS,
  DECLINE_LABELS,
  type DeclineReason,
} from '@/lib/bookingDecline'
import { BookingRequestCard } from '@/components/requests/BookingRequestCard'
import { MatchRequestCard } from '@/components/requests/MatchRequestCard'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'

type Tab = 'bookings' | 'matches'
type FilterKey = 'waiting' | 'active' | 'done' | 'cancelled' | 'all'

const FILTERS: {
  key: FilterKey
  label: string
  test: (booking: Booking) => boolean
}[] = [
  { key: 'waiting', label: 'Waiting', test: (b) => b.status === 'pending' },
  {
    key: 'active',
    label: 'Active',
    test: (b) => b.status === 'confirmed',
  },
  { key: 'done', label: 'Done', test: (b) => b.status === 'completed' },
  {
    key: 'cancelled',
    label: 'Cancelled',
    test: (b) => b.status === 'cancelled',
  },
  { key: 'all', label: 'All', test: () => true },
]

export default function RequestsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const cookId = profile?.id
  const enabled = profile?.role === 'cook'

  const [tab, setTab] = useState<Tab | null>(null)
  const [filter, setFilter] = useState<FilterKey | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null)
  const [decliningBooking, setDecliningBooking] = useState<Booking | null>(null)
  const [decliningMatch, setDecliningMatch] = useState<MatchRequest | null>(
    null,
  )
  const [reason, setReason] = useState<DeclineReason>('booked')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!profile) router.replace('/login')
    else if (profile.role !== 'cook') router.replace('/swipe')
  }, [authLoading, profile, router])

  const bookingsKey = ['cook-bookings', cookId]
  const matchesKey = ['match-requests', cookId]

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: bookingsKey,
    queryFn: () => getMyBookings(cookId!, 'cook'),
    enabled,
    refetchInterval: 20_000,
  })
  const { data: matchRequests = [], isLoading: loadingMatches } = useQuery({
    queryKey: matchesKey,
    queryFn: () => getMatchRequests(cookId!),
    enabled,
    refetchInterval: 20_000,
  })

  const waitingBookings = bookings.filter((b) => b.status === 'pending').length
  const waitingTotal = waitingBookings + matchRequests.length
  const loading = loadingBookings || loadingMatches

  // Open on whichever tab has something waiting.
  const activeTab: Tab =
    tab ??
    (waitingBookings > 0 || matchRequests.length === 0 ? 'bookings' : 'matches')
  const activeFilter: FilterKey =
    filter ?? (waitingBookings > 0 ? 'waiting' : 'all')
  const shownBookings = bookings.filter((b) =>
    FILTERS.find((f) => f.key === activeFilter)!.test(b),
  )

  const refreshEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ['cook-dashboard', cookId] })
    queryClient.invalidateQueries({ queryKey: bookingsKey })
    queryClient.invalidateQueries({ queryKey: matchesKey })
  }

  const setBookingStatus = (id: string, status: Booking['status']) => {
    queryClient.setQueryData<Booking[]>(bookingsKey, (old = []) =>
      old.map((b) => (b.id === id ? { ...b, status } : b)),
    )
  }

  const handleAcceptBooking = async (booking: Booking) => {
    setAcceptingId(booking.id)
    try {
      await acceptBooking(booking.id)
      setBookingStatus(booking.id, 'confirmed')
      toast.success(
        `Accepted. ${booking.buyer?.full_name?.split(' ')[0] ?? 'They'} can pay now.`,
      )
      refreshEverywhere()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not accept this booking',
      )
      refreshEverywhere()
    } finally {
      setAcceptingId(null)
    }
  }

  const closeSheet = () => {
    setDecliningBooking(null)
    setDecliningMatch(null)
    setReason('booked')
    setNote('')
  }

  const submitDeclineBooking = async () => {
    if (!decliningBooking) return
    setSubmitting(true)
    try {
      await declineBooking(decliningBooking.id, reason, note)
      setBookingStatus(decliningBooking.id, 'cancelled')
      toast.success('Declined. They were told why in chat.')
      closeSheet()
      refreshEverywhere()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not decline this booking',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptMatch = async (request: MatchRequest) => {
    if (!cookId) return
    setBusyMatchId(request.swiper_id)
    try {
      const match = await respondToMatchRequest(request.swiper_id, 'accept')
      toast.success('Matched! Say hi.')
      refreshEverywhere()
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      if (match?.id) router.push(`/chat/${match.id}`)
    } catch {
      toast.error('Could not accept this request')
    } finally {
      setBusyMatchId(null)
    }
  }

  const submitDeclineMatch = async () => {
    if (!cookId || !decliningMatch) return
    setSubmitting(true)
    try {
      await respondToMatchRequest(decliningMatch.swiper_id, 'decline')
      queryClient.setQueryData<MatchRequest[]>(matchesKey, (old = []) =>
        old.filter((r) => r.swiper_id !== decliningMatch.swiper_id),
      )
      toast.success('Request declined')
      closeSheet()
      refreshEverywhere()
    } catch {
      toast.error('Could not decline this request')
    } finally {
      setSubmitting(false)
    }
  }

  const unverified = profile?.kyc_status !== 'verified'

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-32">
      <div className="bg-[var(--bg)]/85 sticky top-0 z-10 border-b border-[var(--border)] px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Requests
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {loading
              ? 'Checking for new requests…'
              : waitingTotal > 0
                ? `${waitingTotal} waiting for you`
                : 'You’re all caught up'}
          </p>

          <div
            className="mt-3 flex gap-1 rounded-full p-1"
            style={{ background: 'var(--bg-2)' }}
          >
            {(
              [
                ['bookings', 'Bookings', waitingBookings],
                ['matches', 'Matches', matchRequests.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold"
                style={{
                  color: activeTab === key ? '#fff' : 'var(--text-2)',
                }}
              >
                {activeTab === key && (
                  <motion.span
                    layoutId="requests-tab"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'linear-gradient(135deg, #ff9a52, var(--accent))',
                      boxShadow: 'var(--shadow-warm)',
                    }}
                  />
                )}
                <span className="relative">{label}</span>
                {count > 0 && (
                  <span
                    className="relative flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                    style={{
                      background:
                        activeTab === key
                          ? 'rgba(255,255,255,0.28)'
                          : 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'bookings' && bookings.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => {
                const count = bookings.filter(f.test).length
                const selected = activeFilter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition"
                    style={
                      selected
                        ? {
                            background: 'var(--accent-soft)',
                            borderColor:
                              'color-mix(in srgb, var(--accent) 35%, transparent)',
                            color: 'var(--accent)',
                          }
                        : {
                            borderColor: 'var(--border)',
                            color: 'var(--text-3)',
                          }
                    }
                  >
                    {f.label}
                    {f.key !== 'all' && count > 0 ? ` · ${count}` : ''}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-3 px-4 pt-4">
        {unverified && profile && (
          <Link
            href="/cook/verification"
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{
              background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
            }}
          >
            <ShieldAlert
              className="h-5 w-5 shrink-0"
              style={{ color: 'var(--warning)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-1)' }}>
              <strong>Buyers can’t book you yet.</strong> Verify your identity
              to start receiving booking requests.
            </span>
          </Link>
        )}

        {loading ? (
          [1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))
        ) : activeTab === 'bookings' ? (
          shownBookings.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-7 w-7" />}
              title={
                bookings.length === 0
                  ? 'No booking requests yet'
                  : 'Nothing here'
              }
              text={
                bookings.length === 0
                  ? 'When a buyer books you for a cooking session, it lands here. A fresh story and a full menu help buyers find you.'
                  : 'Try another filter to see your other bookings.'
              }
              actions={
                bookings.length === 0
                  ? [
                      { href: '/stories', label: 'Post a story' },
                      { href: '/cook/specials', label: 'Add a dish' },
                    ]
                  : []
              }
            />
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {shownBookings.map((booking, i) => (
                <BookingRequestCard
                  key={booking.id}
                  booking={booking}
                  index={i}
                  accepting={acceptingId === booking.id}
                  onAccept={handleAcceptBooking}
                  onDecline={setDecliningBooking}
                />
              ))}
            </AnimatePresence>
          )
        ) : matchRequests.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-7 w-7" />}
            title="No new match requests"
            text="When a food lover likes your profile, they show up here. You can also swipe to find them first."
            actions={[{ href: '/swipe', label: 'Go to Discover' }]}
          />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {matchRequests.map((request, i) => (
              <MatchRequestCard
                key={request.id}
                request={request}
                index={i}
                busy={busyMatchId === request.swiper_id}
                onAccept={handleAcceptMatch}
                onDecline={setDecliningMatch}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <BottomSheet
        open={!!decliningBooking}
        onClose={closeSheet}
        title="Decline this booking?"
        description={`${decliningBooking?.buyer?.full_name ?? 'The buyer'} will get your reason in chat.`}
      >
        <div className="flex flex-wrap gap-2">
          {DECLINE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              className="rounded-full border px-3.5 py-2 text-xs font-semibold transition"
              style={
                reason === key
                  ? {
                      background: 'var(--accent-soft)',
                      borderColor:
                        'color-mix(in srgb, var(--accent) 40%, transparent)',
                      color: 'var(--accent)',
                    }
                  : { borderColor: 'var(--border)', color: 'var(--text-2)' }
              }
            >
              {DECLINE_LABELS[key]}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Add a short note (optional)"
          className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none"
          style={{ color: 'var(--text-1)' }}
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={closeSheet}
            className="h-12 flex-1 rounded-xl border border-[var(--border)] text-sm font-semibold"
            style={{ color: 'var(--text-2)' }}
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={submitDeclineBooking}
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-70"
            style={{ background: 'var(--danger)' }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Decline booking
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!decliningMatch}
        onClose={closeSheet}
        title="Decline this request?"
        description={`${decliningMatch?.swiper?.full_name ?? 'They'} won’t be told. They just won’t match with you.`}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeSheet}
            className="h-12 flex-1 rounded-xl border border-[var(--border)] text-sm font-semibold"
            style={{ color: 'var(--text-2)' }}
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={submitDeclineMatch}
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-70"
            style={{ background: 'var(--danger)' }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Decline
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  text,
  actions,
}: {
  icon: React.ReactNode
  title: string
  text: string
  actions: { href: string; label: string }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-6 py-14 text-center"
    >
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
        {title}
      </h2>
      <p
        className="mt-1 max-w-xs text-sm leading-relaxed"
        style={{ color: 'var(--text-3)' }}
      >
        {text}
      </p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-full px-5 py-2.5 text-sm font-bold"
              style={
                i === 0
                  ? {
                      background:
                        'linear-gradient(135deg, #ff9a52, var(--accent))',
                      color: '#fff',
                      boxShadow: 'var(--shadow-warm)',
                    }
                  : {
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  )
}
