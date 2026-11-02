'use client'

import { useState } from 'react'
import {
  MapPin,
  Star,
  Flame,
  BadgeCheck,
  ChefHat,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import Image from 'next/image'

export interface Chef {
  id: string
  role?: 'cook' | 'buyer'
  kyc_status?: 'unverified' | 'pending' | 'verified' | 'rejected' | null
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  location?: string | null
  cuisines?: string[] | null
  price_min?: number | null
  price_max?: number | null
  rating?: number | null
  streak?: number | null
  is_verified?: boolean | null
  photos?: string[] | null
  daily_specials?: Array<{
    title: string
    price: number
    description?: string
  }> | null
}

interface SwipeCardProps {
  chef: Chef
}

// Profiles without a photo get a rich colour card of their own instead of a
// grey blank. The colour is picked from the name so it stays the same.
const PALETTES = [
  'linear-gradient(160deg,#ffb36b 0%,#e8562a 55%,#6e2418 100%)',
  'linear-gradient(160deg,#ffd36b 0%,#ef8a24 55%,#7c3510 100%)',
  'linear-gradient(160deg,#ff9a85 0%,#d23d3d 55%,#561a28 100%)',
  'linear-gradient(160deg,#a3d89a 0%,#3f8f55 55%,#173b2a 100%)',
  'linear-gradient(160deg,#f2a9a3 0%,#b24a6c 55%,#391c39 100%)',
]

function paletteFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTES[hash % PALETTES.length]
}

export function SwipeCard({ chef }: SwipeCardProps) {
  const [imageIndex, setImageIndex] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  const photos =
    chef.photos && chef.photos.length > 0
      ? chef.photos
      : ([chef.avatar_url].filter(Boolean) as string[])

  const currentPhoto = photos[imageIndex] || null
  const name = chef.full_name || 'Chef'
  const location = chef.location || 'Lagos, Nigeria'
  const cuisines = chef.cuisines ?? []

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_28px_60px_-24px_rgba(70,35,15,0.5)]">
      {/* Photo Section */}
      <div
        className={`relative transition-all duration-500 ease-out ${showDetails ? 'h-[40%]' : 'h-full'}`}
      >
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={name}
            fill
            className="pointer-events-none select-none object-cover"
            priority
            draggable={false}
          />
        ) : (
          <div
            className="relative h-full w-full"
            style={{ background: paletteFor(name) }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-radial-gradient(circle at 80% 14%, rgba(255,255,255,0.13) 0 1.5px, transparent 1.5px 28px)',
              }}
            />
            <div className="absolute inset-x-0 top-[12%] flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/40 bg-white/15 text-4xl font-bold text-white shadow-lg backdrop-blur-md">
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        )}

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />
        {!showDetails && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        )}

        {/* Photo Dots */}
        {photos.length > 1 && (
          <div className="absolute left-4 right-4 top-4 z-10 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setImageIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-1 flex-1 rounded-full transition-all ${i === imageIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}

        {/* Collapsed Info Overlay */}
        {!showDetails && (
          <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-4 pt-6">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="truncate font-heading text-[1.7rem] font-bold leading-tight text-white drop-shadow-lg">
                    {name}
                  </h2>
                  {chef.is_verified && (
                    <BadgeCheck className="h-6 w-6 flex-shrink-0 fill-[#4ade80] text-[#4ade80] drop-shadow" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90 drop-shadow">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                  {chef.price_min && (
                    <span className="font-bold text-[#ffd479]">
                      ₦{chef.price_min.toLocaleString()}+
                    </span>
                  )}
                </div>
                {chef.role === 'cook' && chef.kyc_status !== 'verified' && (
                  <p className="mt-2 inline-flex rounded-full border border-amber-200/40 bg-black/35 px-2.5 py-1 text-xs font-medium text-amber-100 backdrop-blur">
                    Match and chat now · booking after KYC approval
                  </p>
                )}
              </div>
              {chef.rating ? (
                <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-white">{chef.rating}</span>
                </div>
              ) : null}
            </div>

            {!currentPhoto && chef.bio && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/90">
                {chef.bio}
              </p>
            )}

            {cuisines.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cuisines.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                  >
                    {c}
                  </span>
                ))}
                {cuisines.length > 3 && (
                  <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    +{cuisines.length - 3}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setShowDetails(true)}
              className="mx-auto mt-3 flex items-center justify-center gap-1 rounded-full px-4 py-1.5 text-white/75 transition-colors hover:text-white"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider">
                View profile
              </span>
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="scrollbar-none relative h-[60%] overflow-y-auto bg-[var(--card)] px-6 pb-6 pt-5">
          <button
            onClick={() => setShowDetails(false)}
            aria-label="Close profile"
            className="absolute right-3 top-3 z-10 rounded-full bg-[var(--bg-2)] p-2 transition-colors hover:bg-[var(--border)]"
          >
            <ChevronDown className="h-4 w-4 text-[var(--text-3)]" />
          </button>

          <div className="mb-1 flex items-center gap-2 pr-10">
            <h2 className="font-heading text-2xl font-bold text-[var(--text-1)]">
              {name}
            </h2>
            {chef.is_verified && (
              <BadgeCheck className="h-5 w-5 flex-shrink-0 fill-[var(--success)] text-[var(--success)]" />
            )}
            {(chef.streak ?? 0) > 1 && (
              <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent)]">
                <Flame className="h-3 w-3" /> {chef.streak}
              </span>
            )}
          </div>

          <div className="mb-3 flex items-center gap-3 text-sm text-[var(--text-3)]">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
            {chef.price_min && (
              <span className="font-bold text-[var(--accent)]">
                ₦{chef.price_min.toLocaleString()}+
              </span>
            )}
          </div>

          {chef.rating ? (
            <div className="mb-4 flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-bold text-[var(--text-1)]">
                {chef.rating}
              </span>
            </div>
          ) : null}

          {cuisines.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {cuisines.map((c) => (
                <span
                  key={c}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-1)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {chef.bio && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                About
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-1)]">
                {chef.bio}
              </p>
            </div>
          )}

          {chef.daily_specials && chef.daily_specials.length > 0 && (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <ChefHat className="h-4 w-4 text-[var(--accent)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Today&apos;s Special
                </span>
              </div>
              <p className="font-semibold text-[var(--text-1)]">
                {chef.daily_specials[0].title}
              </p>
              {chef.daily_specials[0].description && (
                <p className="mt-0.5 text-xs text-[var(--text-3)]">
                  {chef.daily_specials[0].description}
                </p>
              )}
              <p className="mt-1 text-sm font-bold text-[var(--accent)]">
                ₦{chef.daily_specials[0].price.toLocaleString()}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowDetails(false)}
            className="w-full py-3 text-center text-xs font-bold text-[var(--text-3)] transition-colors hover:text-[var(--accent)]"
          >
            Back to photo
          </button>
        </div>
      )}
    </div>
  )
}
