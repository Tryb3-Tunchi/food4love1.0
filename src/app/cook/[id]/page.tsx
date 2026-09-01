import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatNaira } from '@/lib/utils'
import { Star, MapPin, BadgeCheck, ChefHat, UtensilsCrossed } from 'lucide-react'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const sb = await createClient()
  const { data } = await sb
    .from('profiles')
    .select('full_name, bio, cuisines, avatar_url')
    .eq('id', params.id)
    .single()
  if (!data) return { title: 'Chef not found' }
  return {
    title: `${data.full_name} — Home Chef on Food4Love`,
    description:
      data.bio ??
      `${data.full_name} cooks ${data.cuisines?.join(', ')} on Food4Love`,
    openGraph: { images: data.avatar_url ? [data.avatar_url] : [] },
  }
}

export default async function CookPublicPage({
  params,
}: {
  params: { id: string }
}) {
  const sb = await createClient()
  const { data: chef } = await sb
    .from('profiles')
    .select('*, daily_special:daily_specials(*)')
    .eq('id', params.id)
    .eq('role', 'cook')
    .single()
  if (!chef) notFound()

  return (
    <div className="pb-10" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <div className="relative">
        <div
          className="relative h-40 w-full overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-l), var(--divider))',
          }}
        >
          {chef.photos?.[0] && (
            <Image
              src={chef.photos[0]}
              alt={chef.full_name}
              fill
              className="object-cover opacity-70"
            />
          )}
        </div>

        <div className="px-4 pb-0">
          <div className="-mt-10 mb-3 flex items-end gap-4">
            <div className="relative">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 text-2xl font-bold shadow-lift"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--card)',
                  color: 'var(--accent)',
                }}
              >
                {chef.avatar_url ? (
                  <img
                    src={chef.avatar_url}
                    alt={chef.full_name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  chef.full_name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
              {chef.is_verified && (
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
          </div>

          <h1
            className="mb-0.5 font-heading text-2xl font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            {chef.full_name}
          </h1>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Home Chef
            </span>
            {chef.rating && (
              <span className="f4l-badge f4l-badge-accent">
                <Star className="h-3 w-3" />
                {chef.rating.toFixed(1)}
              </span>
            )}
          </div>

          {chef.location && (
            <div className="mb-3 flex items-center gap-1.5">
              <MapPin
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--text-3)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {chef.location}
              </span>
            </div>
          )}

          {chef.bio && (
            <p
              className="mb-4 text-sm leading-relaxed"
              style={{ color: 'var(--text-2)' }}
            >
              {chef.bio}
            </p>
          )}

          {chef.cuisines?.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {chef.cuisines.map((c: string) => (
                <span key={c} className="f4l-badge f4l-badge-muted">
                  {c}
                </span>
              ))}
            </div>
          )}

          {chef.price_min && (
            <div
              className="mb-5 flex items-center justify-between rounded-2xl p-4"
              style={{
                background: 'var(--accent-soft)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
              }}
            >
              <div>
                <p className="f4l-section-label mb-1">Starting from</p>
                <p
                  className="font-heading text-xl font-bold"
                  style={{ color: 'var(--text-1)' }}
                >
                  {formatNaira(chef.price_min)}
                  {chef.price_max ? ` – ${formatNaira(chef.price_max)}` : '+'}
                </p>
              </div>
              <UtensilsCrossed
                className="h-8 w-8"
                style={{ color: 'var(--accent)' }}
              />
            </div>
          )}

          <Link
            href={`/signup?ref_chef=${params.id}`}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-warm)' }}
          >
            <ChefHat className="h-4 w-4" />
            Match with {chef.full_name.split(' ')[0]} →
          </Link>
          <p
            className="pb-6 text-center text-xs"
            style={{ color: 'var(--text-3)' }}
          >
            Join Food4Love to connect with {chef.full_name.split(' ')[0]}
          </p>
        </div>
      </div>
    </div>
  )
}
