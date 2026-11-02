'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  MessageCircle,
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react'
import { bookingAmount } from '@/lib/dashboard'
import { formatAmount } from '@/lib/payments'
import { getInitials } from '@/lib/utils'
import type { Booking } from '@/services/bookings'

function badgeFor(booking: Booking) {
  switch (booking.status) {
    case 'pending':
      return { label: 'Waiting for you', tone: 'f4l-badge-warning' }
    case 'confirmed':
      return booking.payment_status === 'paid'
        ? { label: 'Paid', tone: 'f4l-badge-success' }
        : { label: 'Accepted · awaiting payment', tone: 'f4l-badge-accent' }
    case 'completed':
      return { label: 'Completed', tone: 'f4l-badge-success' }
    default:
      return { label: 'Cancelled', tone: 'f4l-badge-muted' }
  }
}

function eventLabel(booking: Booking) {
  if (!booking.scheduled_for) return null
  const day = new Date(booking.scheduled_for)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { text: 'Date has passed', urgent: true }
  if (diff === 0) return { text: 'Today', urgent: true }
  if (diff === 1) return { text: 'Tomorrow', urgent: true }
  return { text: `In ${diff} days`, urgent: diff <= 3 }
}

export function BookingRequestCard({
  booking,
  index,
  accepting,
  onAccept,
  onDecline,
}: {
  booking: Booking
  index: number
  accepting: boolean
  onAccept: (booking: Booking) => void
  onDecline: (booking: Booking) => void
}) {
  const buyerName = booking.buyer?.full_name ?? 'Food lover'
  const badge = badgeFor(booking)
  const event = booking.status === 'pending' ? eventLabel(booking) : null
  const waiting = booking.status === 'pending'
  const address = booking.service_address
  const meal = booking.meal_description
  const guests = booking.guest_count

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ delay: Math.min(index, 6) * 0.05, type: 'spring' }}
      className="f4l-card overflow-hidden"
      style={
        waiting
          ? {
              borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
            }
          : undefined
      }
    >
      <Link
        href={`/bookings/${booking.id}`}
        className="block p-4 pb-3"
        aria-label={`Open booking from ${buyerName}`}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {booking.buyer?.avatar_url ? (
              <img
                src={booking.buyer.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(buyerName)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              {buyerName}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Requested{' '}
              {formatDistanceToNowStrict(new Date(booking.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
          <div className="text-right">
            <p
              className="font-heading text-base font-bold"
              style={{ color: 'var(--text-1)' }}
            >
              {formatAmount(bookingAmount(booking))}
            </p>
            <span className={`f4l-badge ${badge.tone}`}>{badge.label}</span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <CalendarDays
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span style={{ color: 'var(--text-1)' }}>
              {booking.scheduled_for
                ? new Date(booking.scheduled_for).toLocaleString('en-NG', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Date to be confirmed'}
            </span>
            {event && (
              <span
                className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: event.urgent
                    ? 'color-mix(in srgb, var(--warning) 18%, transparent)'
                    : 'var(--bg-2)',
                  color: event.urgent ? 'var(--warning)' : 'var(--text-3)',
                }}
              >
                {event.text}
              </span>
            )}
          </div>
          {address && (
            <div className="flex items-start gap-2">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span className="line-clamp-1" style={{ color: 'var(--text-2)' }}>
                {address}
              </span>
            </div>
          )}
          {guests ? (
            <div className="flex items-center gap-2">
              <Users
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-2)' }}>
                {guests} {guests === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          ) : null}
          {meal && (
            <div className="flex items-start gap-2">
              <UtensilsCrossed
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span className="line-clamp-2" style={{ color: 'var(--text-2)' }}>
                {meal}
              </span>
            </div>
          )}
        </div>

        {booking.special_requests && waiting && (
          <p
            className="mt-3 rounded-xl px-3 py-2 text-xs italic"
            style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
          >
            “{booking.special_requests}”
          </p>
        )}
      </Link>

      {waiting ? (
        <div className="flex gap-2 border-t border-[var(--divider)] p-3">
          <button
            type="button"
            onClick={() => onDecline(booking)}
            disabled={accepting}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
            style={{ color: 'var(--text-2)' }}
          >
            <X className="h-4 w-4" />
            Decline
          </button>
          <Link
            href={`/chat/${booking.match_id}`}
            aria-label={`Message ${buyerName}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] transition active:scale-95"
            style={{ color: 'var(--text-2)' }}
          >
            <MessageCircle className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => onAccept(booking)}
            disabled={accepting}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white transition active:scale-95 disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #ff9a52, var(--accent))',
              boxShadow: 'var(--shadow-warm)',
            }}
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={3} />
            )}
            Accept
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-[var(--divider)] px-4 py-2.5">
          <Link
            href={`/chat/${booking.match_id}`}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--text-2)' }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Message {buyerName.split(' ')[0]}
          </Link>
          <Link
            href={`/bookings/${booking.id}`}
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            View order
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </motion.article>
  )
}
