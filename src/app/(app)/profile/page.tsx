'use client'

import { useQuery } from '@tanstack/react-query'
import { getDailySpecialsByCook } from '@/services/dailySpecials'
import { getReviewsForProfile, getReviewStats } from '@/services/reviews'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  MapPin,
  BadgeCheck,
  Clock,
  Users,
  Flame,
  Share2,
  Settings,
  ChevronRight,
  Calendar,
  MessageCircle,
  Heart,
  Camera,
  Edit3,
  Shield,
  UtensilsCrossed,
  LogOut,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatNaira } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useProfile } from '@/hooks/useProfile'
;('')
const TABS = ['Overview', 'Specials', 'Reviews', 'Info'] as const
type Tab = (typeof TABS)[number]

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-4 py-3"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
    >
      <span className="text-xl">{icon}</span>
      <span
        className="text-center text-xs font-semibold leading-tight"
        style={{ color: 'var(--text-2)' }}
      >
        {label}
      </span>
    </div>
  )
}

function SkeletonLine({ w = '100%', h = '1rem' }: { w?: string; h?: string }) {
  return (
    <div className="f4l-skeleton rounded-lg" style={{ width: w, height: h }} />
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const [tab, setTab] = useState<Tab>('Overview')
  const [editing, setEditing] = useState(false)

  const isCook = profile?.role === 'cook'
  const isVerified = profile?.kyc_status === 'verified'

  const { data: specials = [], isLoading: specialsLoading } = useQuery({
    queryKey: ['daily-specials', profile?.id],
    queryFn: () => getDailySpecialsByCook(profile!.id),
    enabled: !!profile?.id && isCook,
  })

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', profile?.id],
    queryFn: () => getReviewsForProfile(profile!.id),
    enabled: !!profile?.id,
  })

  const { data: reviewStats = { average: 0, count: 0, distribution: [] } } =
    useQuery({
      queryKey: ['review-stats', profile?.id],
      queryFn: () => getReviewStats(profile!.id),
      enabled: !!profile?.id,
    })

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const handleShare = () => {
    if (profile) {
      navigator.clipboard.writeText(
        `${window.location.origin}/cook/${profile.id}`,
      )
      toast.success('Profile link copied!')
    }
  }

  if (!profile) {
    return (
      <div className="space-y-4 px-4 py-6">
        <SkeletonLine h="8rem" />
        <SkeletonLine w="60%" h="1.5rem" />
        <SkeletonLine w="40%" />
        <SkeletonLine h="6rem" />
      </div>
    )
  }

  const ratingDisplay = (profile.rating ?? 0).toFixed(1)
  const visibleTabs = isCook ? TABS : (['Overview', 'Info'] as Tab[])

  return (
    <div className="pb-24" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <div className="relative">
        <div
          className="relative h-36 w-full overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-l), var(--divider))',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="text-8xl">{isCook ? '🍲' : '🍽️'}</span>
          </div>
          {isCook && (
            <button
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: 'var(--card)', color: 'var(--text-2)' }}
            >
              <Camera className="h-3.5 w-3.5" />
              Edit cover
            </button>
          )}
        </div>

        <div className="px-4 pb-0">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 text-4xl shadow-lift"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--card)',
                }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <span>{isCook ? '🧑‍🍳' : '🧑'}</span>
                )}
              </div>
              {isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white"
                  style={{ background: 'var(--success)' }}
                >
                  <BadgeCheck
                    className="h-3.5 w-3.5 text-white"
                    strokeWidth={3}
                  />
                </div>
              )}
            </div>

            <div className="mb-1 flex gap-2">
              <button
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                }}
                aria-label="Share profile"
              >
                <Share2
                  className="h-4 w-4"
                  style={{ color: 'var(--text-2)' }}
                />
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                }}
                aria-label="Edit profile"
              >
                <Edit3 className="h-4 w-4" style={{ color: 'var(--text-2)' }} />
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                }}
                aria-label="Settings"
              >
                <Settings
                  className="h-4 w-4"
                  style={{ color: 'var(--text-2)' }}
                />
              </button>
            </div>
          </div>

          <h1
            className="mb-0.5 font-heading text-2xl font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            {profile.full_name}
          </h1>
          <p
            className="mb-1.5 text-sm font-medium capitalize"
            style={{ color: 'var(--accent)' }}
          >
            {isCook ? 'Home Chef' : 'Food Lover'}
          </p>

          {profile.location && (
            <div className="mb-3 flex items-center gap-1.5">
              <MapPin
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--text-3)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {profile.location}
              </span>
              {profile.streak && profile.streak > 1 && (
                <span
                  className="ml-2 flex items-center gap-0.5 text-xs font-bold"
                  style={{ color: 'var(--accent-alt)' }}
                >
                  <Flame
                    className="h-3 w-3"
                    style={{ color: 'var(--accent-alt)' }}
                  />
                  {profile.streak}d streak
                </span>
              )}
            </div>
          )}

          {profile.bio && (
            <p
              className="mb-4 text-sm leading-relaxed"
              style={{ color: 'var(--text-2)' }}
            >
              {profile.bio}
            </p>
          )}

          {isCook && profile.kyc_status !== 'verified' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-3 rounded-2xl p-3"
              style={{
                background:
                  profile.kyc_status === 'pending'
                    ? 'color-mix(in srgb, var(--warning) 12%, transparent)'
                    : 'color-mix(in srgb, var(--danger) 8%, transparent)',
                border: `1px solid ${profile.kyc_status === 'pending' ? 'color-mix(in srgb, var(--warning) 35%, transparent)' : 'color-mix(in srgb, var(--danger) 22%, transparent)'}`,
              }}
            >
              <Shield
                className="h-5 w-5 shrink-0"
                style={{
                  color:
                    profile.kyc_status === 'pending'
                      ? 'var(--warning)'
                      : 'var(--danger)',
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-bold"
                  style={{
                    color:
                      profile.kyc_status === 'pending'
                        ? 'var(--warning)'
                        : 'var(--danger)',
                  }}
                >
                  {profile.kyc_status === 'pending'
                    ? 'KYC under review — usually 24–48h'
                    : 'Verify your identity to start selling'}
                </p>
                {profile.kyc_status !== 'pending' && (
                  <button
                    onClick={() => router.push('/onboarding/kyc')}
                    className="mt-0.5 text-xs font-semibold"
                    style={{ color: 'var(--danger)' }}
                  >
                    Complete verification →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {isCook && (
            <div className="mb-5 flex gap-2">
              <StatPill icon="⭐" label={`${ratingDisplay} Rating`} />
              <StatPill
                icon="🍽"
                label={`${profile.review_count ?? 0} Reviews`}
              />
              <StatPill icon="💬" label="< 1h Reply" />
            </div>
          )}

          {isCook && profile.cuisines && profile.cuisines.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {profile.cuisines.map((c: string) => (
                <span key={c} className="f4l-badge f4l-badge-accent">
                  {c}
                </span>
              ))}
            </div>
          )}

          {isCook && profile.price_min && (
            <div
              className="mb-5 flex items-center justify-between rounded-2xl p-4"
              style={{
                background: 'var(--accent-soft)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
              }}
            >
              <div>
                <p className="f4l-section-label mb-1">Price range</p>
                <p
                  className="font-heading text-xl font-bold"
                  style={{ color: 'var(--text-1)' }}
                >
                  {formatNaira(profile.price_min)}
                  {profile.price_max
                    ? ` – ${formatNaira(profile.price_max)}`
                    : '+'}
                </p>
              </div>
              <button
                onClick={() => router.push('/cook/specials')}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'var(--shadow-warm)',
                }}
              >
                <UtensilsCrossed className="h-4 w-4" />
                Manage
              </button>
            </div>
          )}

          {!isCook && (
            <button
              onClick={() => router.push('/swipe')}
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all active:scale-95"
              style={{
                background: 'var(--accent)',
                boxShadow: 'var(--shadow-warm)',
              }}
            >
              <Calendar className="h-4 w-4" />
              Find a Chef
            </button>
          )}
        </div>
      </div>

      {/* Sticky Tabs */}
      <div
        className="sticky top-0 z-20 px-4 pb-0 pt-2"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        <div className="flex gap-1">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-4 py-3 text-sm font-semibold transition-all"
              style={{ color: tab === t ? 'var(--accent)' : 'var(--text-3)' }}
            >
              {t}
              {tab === t && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="px-4 pt-5"
        >
          {/* Overview */}
          {tab === 'Overview' && (
            <div className="space-y-5">
              <div>
                <p className="f4l-section-label mb-3">About</p>
                <div className="f4l-card p-4">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {profile.bio ?? 'No bio yet. Tap edit to add one.'}
                  </p>
                </div>
              </div>

              {isCook && (
                <div>
                  <p className="f4l-section-label mb-3">Details</p>
                  <div
                    className="f4l-card divide-y"
                    style={{ borderColor: 'var(--divider)' }}
                  >
                    {[
                      {
                        label: 'Availability',
                        value: 'Mon–Sat · 12pm–8pm',
                        icon: Clock,
                      },
                      { label: 'Serves', value: '1–6 people', icon: Users },
                      {
                        label: 'Response time',
                        value: 'Usually within 1 hour',
                        icon: MessageCircle,
                      },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 p-4">
                        <Icon
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--accent)' }}
                        />
                        <div className="flex-1">
                          <p
                            className="text-xs"
                            style={{ color: 'var(--text-3)' }}
                          >
                            {label}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-1)' }}
                          >
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="f4l-section-label mb-3">Share & Earn</p>
                <div className="f4l-card flex items-center gap-3 p-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--accent-l)' }}
                  >
                    <Heart
                      className="h-5 w-5"
                      style={{ color: 'var(--accent)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-bold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      Refer a friend
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {isCook
                        ? 'Invite a food lover — earn when they book'
                        : 'Invite a friend — earn rewards'}
                    </p>
                  </div>
                  <button
                    onClick={handleShare}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{
                  background:
                    'color-mix(in srgb, var(--danger) 6%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--danger) 18%, transparent)',
                }}
              >
                <LogOut
                  className="h-4 w-4"
                  style={{ color: 'var(--danger)' }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--danger)' }}
                >
                  Sign out
                </span>
              </button>
            </div>
          )}

          {/* Specials */}
          {tab === 'Specials' && isCook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Today's Specials
                </h3>
                <button
                  onClick={() => router.push('/cook/specials')}
                  className="text-xs font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  + Add special
                </button>
              </div>
              {specialsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                </div>
              ) : specials.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                  <div className="mb-3 text-3xl">🍽️</div>
                  <p className="text-white/60">No specials posted yet.</p>
                  <p className="mt-1 text-sm text-white/40">
                    Add a daily special to attract more buyers.
                  </p>
                  <button
                    onClick={() => router.push('/cook/specials')}
                    className="mt-4 rounded-full px-4 py-2 text-xs font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    Create your first special
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {specials.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-2xl">
                        🍽️
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-white">{s.title}</h4>
                        {s.description && (
                          <p className="mt-1 text-sm text-white/60">
                            {s.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--accent)' }}
                          >
                            {formatNaira(s.price)}
                          </span>
                          <span className="rounded-full bg-[#84CC16]/20 px-2 py-0.5 text-xs text-[#84CC16]">
                            Available until{' '}
                            {new Date(s.available_until).toLocaleTimeString(
                              'en-NG',
                              { hour: 'numeric', minute: '2-digit' },
                            )}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {tab === 'Reviews' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-white">
                    {reviewStats.average > 0
                      ? reviewStats.average.toFixed(1)
                      : '—'}
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`h-5 w-5 ${i < Math.round(reviewStats.average) ? 'text-[#F59E0B]' : 'text-white/20'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-white/60">
                    {reviewStats.count} review
                    {reviewStats.count !== 1 ? 's' : ''}
                  </span>
                </div>
                {reviewStats.count > 0 && (
                  <div className="mt-3 space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const dist = reviewStats.distribution.find(
                        (d) => d.star === star,
                      )
                      const pct =
                        reviewStats.count > 0
                          ? ((dist?.count ?? 0) / reviewStats.count) * 100
                          : 0
                      return (
                        <div
                          key={star}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="w-3 text-white/60">{star}</span>
                          <svg
                            className="h-3 w-3 text-[#F59E0B]"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <div className="h-1.5 flex-1 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-[#F59E0B]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-white/40">
                            {dist?.count ?? 0}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                  <div className="mb-3 text-3xl">⭐</div>
                  <p className="text-white/60">No reviews yet.</p>
                  <p className="mt-1 text-sm text-white/40">
                    {isCook
                      ? 'Complete bookings to start receiving reviews.'
                      : 'Book a meal and leave a review after.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm">
                            {r.reviewer?.avatar_url ? (
                              <img
                                src={r.reviewer.avatar_url}
                                alt=""
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              '👤'
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {r.reviewer?.full_name ?? 'Anonymous'}
                            </p>
                            <p className="text-xs text-white/40">
                              {new Date(r.created_at).toLocaleDateString(
                                'en-NG',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${i < r.rating ? 'text-[#F59E0B]' : 'text-white/20'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      {r.comment && (
                        <p className="mt-3 text-sm text-white/70">
                          "{r.comment}"
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          {tab === 'Info' && (
            <div className="space-y-3">
              {[
                {
                  label: 'Member since',
                  value: new Date(profile.created_at ?? '').toLocaleDateString(
                    'en-NG',
                    { month: 'long', year: 'numeric' },
                  ),
                },
                { label: 'Role', value: isCook ? 'Home Chef' : 'Food Lover' },
                {
                  label: 'Identity',
                  value: isVerified ? '✓ Verified' : 'Unverified',
                },
                {
                  label: 'KYC status',
                  value: profile.kyc_status ?? 'Not submitted',
                },
                ...(profile.price_min
                  ? [
                      {
                        label: 'Min price',
                        value: formatNaira(profile.price_min),
                      },
                    ]
                  : []),
                ...(profile.price_max
                  ? [
                      {
                        label: 'Max price',
                        value: formatNaira(profile.price_max),
                      },
                    ]
                  : []),
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="f4l-card flex items-center justify-between p-4"
                >
                  <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                    {label}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
