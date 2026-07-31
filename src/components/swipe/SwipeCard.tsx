"use client";

import { useState } from "react";
import { MapPin, Star, Flame, BadgeCheck, ChefHat, ChevronUp, ChevronDown } from "lucide-react";
import Image from "next/image";

export interface Chef {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  cuisines?: string[] | null;
  price_min?: number | null;
  price_max?: number | null;
  rating?: number | null;
  streak?: number | null;
  is_verified?: boolean | null;
  photos?: string[] | null;
  daily_specials?: Array<{ title: string; price: number; description?: string }> | null;
}

interface SwipeCardProps {
  chef: Chef;
}

export function SwipeCard({ chef }: SwipeCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const photos = chef.photos && chef.photos.length > 0
    ? chef.photos
    : [chef.avatar_url].filter(Boolean) as string[];

  const currentPhoto = photos[imageIndex] || null;
  const name = chef.full_name || "Chef";
  const location = chef.location || "Lagos, Nigeria";

  return (
    <div className="w-full h-full rounded-[32px] overflow-hidden shadow-2xl bg-[var(--card)] border border-[var(--border)] relative">
      {/* Photo Section */}
      <div className={`relative transition-all duration-500 ease-out ${showDetails ? 'h-[40%]' : 'h-full'}`}>
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={name}
            fill
            className="object-cover pointer-events-none select-none"
            priority
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--primary)]/30 via-[var(--bg-2)] to-[var(--bg)] flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[var(--primary)] to-[#ff6b35] flex items-center justify-center text-5xl font-bold text-white shadow-2xl">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none" />
        {!showDetails && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />}

        {/* Photo Dots */}
        {photos.length > 1 && (
          <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-10">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setImageIndex(i)}
                className={`h-1 rounded-full flex-1 transition-all ${i === imageIndex ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}

        {/* Collapsed Info Overlay */}
        {!showDetails && (
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 z-10">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold text-white drop-shadow-lg truncate">{name}</h2>
                  {chef.is_verified && <BadgeCheck className="w-6 h-6 text-[#4ade80] fill-[#4ade80] drop-shadow flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-3 text-white/90 text-sm drop-shadow">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {location}
                  </span>
                  {chef.price_min && (
                    <span className="font-bold text-[#ffd700]">₦{chef.price_min.toLocaleString()}+</span>
                  )}
                </div>
              </div>
              {chef.rating && (
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex-shrink-0">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-bold">{chef.rating}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetails(true)}
              className="mt-4 flex items-center justify-center gap-1 w-full py-2 text-white/70 hover:text-white transition-colors"
            >
              <span className="text-xs font-bold tracking-wider uppercase">Full Profile</span>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="h-[60%] bg-[var(--card)] px-6 pt-5 pb-6 overflow-y-auto scrollbar-none relative">
          <button
            onClick={() => setShowDetails(false)}
            className="absolute top-3 right-3 p-2 rounded-full bg-[var(--bg-2)] hover:bg-[var(--border)] transition-colors z-10"
          >
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <div className="flex items-center gap-2 mb-1 pr-10">
            <h2 className="text-2xl font-bold text-[var(--text)]">{name}</h2>
            {chef.is_verified && <BadgeCheck className="w-5 h-5 text-[var(--success)] fill-[var(--success)] flex-shrink-0" />}
            {chef.streak && chef.streak > 1 && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full flex-shrink-0">
                <Flame className="w-3 h-3" /> {chef.streak}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {location}
            </span>
            {chef.price_min && (
              <span className="font-bold text-[var(--primary)]">₦{chef.price_min.toLocaleString()}+</span>
            )}
          </div>

          {chef.rating && (
            <div className="flex items-center gap-1.5 mb-4">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-bold text-[var(--text)]">{chef.rating}</span>
              <span className="text-xs text-[var(--text-muted)]">(12 reviews)</span>
            </div>
          )}

          {chef.cuisines && chef.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {chef.cuisines.map((c) => (
                <span key={c} className="px-3 py-1.5 rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)]">
                  {c}
                </span>
              ))}
            </div>
          )}

          {chef.bio && (
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">About</h3>
              <p className="text-sm text-[var(--text)] leading-relaxed">{chef.bio}</p>
            </div>
          )}

          {chef.daily_specials && chef.daily_specials.length > 0 && (
            <div className="bg-gradient-to-r from-[var(--primary)]/10 to-transparent border border-[var(--primary)]/20 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ChefHat className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Today&apos;s Special</span>
              </div>
              <p className="font-semibold text-[var(--text)]">{chef.daily_specials[0].title}</p>
              {chef.daily_specials[0].description && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{chef.daily_specials[0].description}</p>
              )}
              <p className="text-sm font-bold text-[var(--primary)] mt-1">₦{chef.daily_specials[0].price.toLocaleString()}</p>
            </div>
          )}

          <button
            onClick={() => setShowDetails(false)}
            className="w-full py-3 text-center text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          >
            Tap to close
          </button>
        </div>
      )}
    </div>
  );
}