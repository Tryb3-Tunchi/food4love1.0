'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Circle,
  Clock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyBookings } from '@/services/bookings'
import { getDailySpecialsByCook } from '@/services/dailySpecials'
import { getCookAvailability } from '@/services/availability'
import { getMyLatestKycSubmission } from '@/services/verification'
import { getQualityChecks, qualityPercent } from '@/lib/verification'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const REQUIREMENTS = [
  'A valid ID: NIN, BVN, passport or driver’s licence',
  'A short video of your face',
]

const RESUBMIT_TIPS = [
  'Photograph your ID in good light with all four corners visible',
  'Make sure the name and number are readable',
  'Record the face video somewhere bright, looking at the camera',
]

const VERIFIED_MEANS = [
  'Our team checked your ID and your face video.',
  'You can accept bookings.',
  'A verified badge shows on your public profile.',
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2 text-sm"
          style={{ color: 'var(--text-2)' }}
        >
          <Check
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: 'var(--accent)' }}
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function CookVerificationPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)

  useEffect(() => {
    if (authLoading) return
    if (!profile) router.replace('/login')
    else if (profile.role !== 'cook') router.replace('/swipe')
  }, [authLoading, profile, router])

  const enabled = profile?.role === 'cook'

  const { data: submission, isLoading: loadingKyc } = useQuery({
    queryKey: ['cook-kyc', profile?.id],
    queryFn: () => getMyLatestKycSubmission(profile!.id),
    enabled,
  })
  const { data: quality, isLoading: loadingQuality } = useQuery({
    queryKey: ['cook-quality', profile?.id],
    queryFn: async () => {
      const [dishes, availability, bookings] = await Promise.all([
        getDailySpecialsByCook(profile!.id).catch(() => []),
        getCookAvailability(profile!.id),
        getMyBookings(profile!.id, 'cook').catch(() => []),
      ])
      return {
        dishes,
        availability,
        waitingBookings: bookings.filter((b) => b.status === 'pending').length,
      }
    },
    enabled,
  })

  const kyc = profile?.kyc_status ?? 'unverified'
  const checks =
    profile && quality ? getQualityChecks({ profile, ...quality }) : []
  const percent = qualityPercent(checks)

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Verification
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Your ID check, and how to make your profile stand out.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 p-4"
      >
        <section className="f4l-card p-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-soft)' }}
            >
              {kyc === 'verified' ? (
                <ShieldCheck
                  className="h-5 w-5"
                  style={{ color: 'var(--accent)' }}
                />
              ) : kyc === 'pending' ? (
                <Clock className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              ) : (
                <ShieldAlert
                  className="h-5 w-5"
                  style={{ color: 'var(--accent)' }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-1)' }}
                >
                  {kyc === 'verified'
                    ? 'You’re verified'
                    : kyc === 'pending'
                      ? 'Under review'
                      : kyc === 'rejected'
                        ? 'Not approved'
                        : 'Not verified yet'}
                </p>
                {kyc === 'verified' && (
                  <span className="f4l-badge f4l-badge-success">
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
                {kyc === 'pending' && (
                  <span className="f4l-badge f4l-badge-warning">Pending</span>
                )}
                {kyc === 'rejected' && (
                  <span className="f4l-badge f4l-badge-warning">
                    Action needed
                  </span>
                )}
              </div>

              {loadingKyc ? (
                <Skeleton className="mt-2 h-4 w-48" />
              ) : kyc === 'verified' ? (
                <>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--text-3)' }}
                  >
                    What verified means:
                  </p>
                  <BulletList items={VERIFIED_MEANS} />
                </>
              ) : kyc === 'pending' ? (
                <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
                  {submission
                    ? `You submitted on ${formatDate(submission.submitted_at)}. `
                    : ''}
                  Reviews usually take 24–48 hours. There is nothing more to do
                  right now. This page updates when the review is done.
                </p>
              ) : kyc === 'rejected' ? (
                <>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {submission?.reviewed_at
                      ? `Reviewed on ${formatDate(submission.reviewed_at)}`
                      : 'Reviewed by our team'}
                  </p>
                  <div
                    className="mt-3 rounded-xl p-3"
                    style={{ background: 'var(--accent-soft)' }}
                  >
                    <p className="f4l-section-label mb-1">Reason</p>
                    <p className="text-sm" style={{ color: 'var(--text-1)' }}>
                      {submission?.rejection_reason ||
                        'No reason was recorded. Submit again with clearer documents.'}
                    </p>
                  </div>
                  <p
                    className="mt-3 text-sm font-medium"
                    style={{ color: 'var(--text-1)' }}
                  >
                    What to do
                  </p>
                  <BulletList items={RESUBMIT_TIPS} />
                </>
              ) : (
                <>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--text-2)' }}
                  >
                    You can’t take bookings until you’re verified. You’ll need:
                  </p>
                  <BulletList items={REQUIREMENTS} />
                </>
              )}

              {(kyc === 'unverified' || kyc === 'rejected') && (
                <Link href="/onboarding/kyc" className="mt-4 block">
                  <Button className="w-full bg-[var(--accent)]">
                    {kyc === 'rejected' ? 'Submit again' : 'Start verification'}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="f4l-section-label">Profile quality</p>
            {!loadingQuality && (
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                {percent}%
              </span>
            )}
          </div>
          <div
            className="mb-3 h-2 overflow-hidden rounded-full"
            style={{ background: 'var(--divider)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, background: 'var(--accent)' }}
            />
          </div>

          {loadingQuality ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <div className="f4l-card divide-y divide-[var(--divider)]">
              {checks.map((check) => (
                <Link key={check.key} href={check.href}>
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: check.done
                          ? 'var(--accent)'
                          : 'var(--accent-soft)',
                      }}
                    >
                      {check.done ? (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      ) : (
                        <Circle
                          className="h-2.5 w-2.5"
                          style={{ color: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-1)' }}
                      >
                        {check.label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {check.hint}
                      </p>
                    </div>
                    {!check.done && (
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: 'var(--text-3)' }}
                      />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  )
}
