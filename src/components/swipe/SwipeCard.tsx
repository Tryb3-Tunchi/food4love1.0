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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-2xl">
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
          <div className="from-[var(--primary)]/30 flex h-full w-full items-center justify-center bg-gradient-to-br via-[var(--bg-2)] to-[var(--bg)]">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[#ff6b35] text-5xl font-bold text-white shadow-2xl">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
        {!showDetails && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        )}

        {/* Photo Dots */}
        {photos.length > 1 && (
          <div className="absolute left-4 right-4 top-4 z-10 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setImageIndex(i)}
                className={`h-1 flex-1 rounded-full transition-all ${i === imageIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}

        {/* Collapsed Info Overlay */}
        {!showDetails && (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-6 pb-8">
            <div className="flex items-end justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="truncate text-3xl font-bold text-white drop-shadow-lg">
                    {name}
                  </h2>
                  {chef.is_verified && (
                    <BadgeCheck className="h-6 w-6 flex-shrink-0 fill-[#4ade80] text-[#4ade80] drop-shadow" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-white/90 drop-shadow">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                  {chef.price_min && (
                    <span className="font-bold text-[#ffd700]">
                      ₦{chef.price_min.toLocaleString()}+
                    </span>
                  )}
                </div>
              </div>
              {chef.rating && (
                <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-white">{chef.rating}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetails(true)}
              className="mt-4 flex w-full items-center justify-center gap-1 py-2 text-white/70 transition-colors hover:text-white"
            >
              <span className="text-xs font-bold uppercase tracking-wider">
                Full Profile
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
            className="absolute right-3 top-3 z-10 rounded-full bg-[var(--bg-2)] p-2 transition-colors hover:bg-[var(--border)]"
          >
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          </button>

          <div className="mb-1 flex items-center gap-2 pr-10">
            <h2 className="text-2xl font-bold text-[var(--text)]">{name}</h2>
            {chef.is_verified && (
              <BadgeCheck className="h-5 w-5 flex-shrink-0 fill-[var(--success)] text-[var(--success)]" />
            )}
            {chef.streak && chef.streak > 1 && (
              <span className="bg-[var(--primary)]/10 flex flex-shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
                <Flame className="h-3 w-3" /> {chef.streak}
              </span>
            )}
          </div>

          <div className="mb-3 flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
            {chef.price_min && (
              <span className="font-bold text-[var(--primary)]">
                ₦{chef.price_min.toLocaleString()}+
              </span>
            )}
          </div>

          {chef.rating && (
            <div className="mb-4 flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-bold text-[var(--text)]">
                {chef.rating}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                (12 reviews)
              </span>
            </div>
          )}

          {chef.cuisines && chef.cuisines.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chef.cuisines.map((c) => (
                <span
                  key={c}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {chef.bio && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                About
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text)]">
                {chef.bio}
              </p>
            </div>
          )}

          {chef.daily_specials && chef.daily_specials.length > 0 && (
            <div className="from-[var(--primary)]/10 border-[var(--primary)]/20 mb-4 rounded-2xl border bg-gradient-to-r to-transparent p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <ChefHat className="h-4 w-4 text-[var(--primary)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                  Today&apos;s Special
                </span>
              </div>
              <p className="font-semibold text-[var(--text)]">
                {chef.daily_specials[0].title}
              </p>
              {chef.daily_specials[0].description && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {chef.daily_specials[0].description}
                </p>
              )}
              <p className="mt-1 text-sm font-bold text-[var(--primary)]">
                ₦{chef.daily_specials[0].price.toLocaleString()}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowDetails(false)}
            className="w-full py-3 text-center text-xs font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
          >
            Tap to close
          </button>
        </div>
      )}
    </div>
  )
}
