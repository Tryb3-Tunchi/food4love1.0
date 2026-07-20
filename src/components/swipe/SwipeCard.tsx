'use client'
import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import Image from 'next/image'
import { MapPin, Star, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatNaira } from '@/lib/utils'
import { Profile } from '@/types/db'

interface SwipeCardProps {
  chef: Profile
  onLike: () => void
  onPass: () => void
  onInfo: () => void
  isTop: boolean
}

export function SwipeCard({
  chef,
  onLike,
  onPass,
  onInfo,
  isTop,
}: SwipeCardProps) {
  const [{ x, rotate, scale, opacity }, api] = useSpring(() => ({
    x: 0,
    rotate: 0,
    scale: isTop ? 1 : 0.95,
    opacity: 1,
    config: { tension: 300, friction: 20 },
  }))

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], last }) => {
      if (!isTop) return
      const trigger = Math.abs(mx) > 120 || (last && Math.abs(vx) > 0.5)
      if (last && trigger) {
        api.start({
          x: dx > 0 ? 1000 : -1000,
          rotate: dx > 0 ? 30 : -30,
          opacity: 0,
          config: { tension: 200, friction: 15 },
        })
        setTimeout(() => {
          dx > 0 ? onLike() : onPass()
        }, 300)
      } else {
        api.start({
          x: active ? mx : 0,
          rotate: active ? mx / 18 : 0,
          scale: active ? 1.03 : isTop ? 1 : 0.95,
          immediate: (key) => active && (key === 'x' || key === 'rotate'),
        })
      }
    },
    { filterTaps: true, bounds: { left: -500, right: 500 }, rubberband: true },
  )

  const likeOpacity = x.to({ range: [-120, 0, 120], output: [0, 0, 1] })
  const passOpacity = x.to({ range: [-120, 0, 120], output: [1, 0, 0] })
  const photo = chef.photos?.[0] ?? chef.avatar_url

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      style={{ x, rotate, scale, opacity, touchAction: 'none' }}
      className="absolute inset-0 cursor-grab select-none active:cursor-grabbing"
    >
      <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-2xl)] border border-[color:var(--border)] bg-card shadow-float">
        {photo ? (
          <Image
            src={photo}
            alt={chef.full_name ?? ''}
            fill
            className="pointer-events-none object-cover"
            sizes="(max-width: 500px) 100vw, 500px"
            priority={isTop}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--bg-3)]">
            <Avatar
              src={chef.avatar_url}
              name={chef.full_name ?? chef.name ?? ''}
              size="2xl"
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* STAMPS USING VARIANT VARIABLES */}
        <animated.div
          style={{ opacity: likeOpacity }}
          className="absolute left-6 top-10 rotate-[-15deg] rounded-xl border-4 border-[color:var(--success)] bg-black/20 px-4 py-1 backdrop-blur-sm"
        >
          <span className="text-2xl font-black tracking-widest text-[color:var(--success)]">
            LIKE
          </span>
        </animated.div>

        <animated.div
          style={{ opacity: passOpacity }}
          className="absolute right-6 top-10 rotate-[15deg] rounded-xl border-4 border-[color:var(--danger)] bg-black/20 px-4 py-1 backdrop-blur-sm"
        >
          <span className="text-2xl font-black tracking-widest text-[color:var(--danger)]">
            PASS
          </span>
        </animated.div>

        {chef.daily_special && (
          <div className="absolute left-4 right-4 top-4 flex justify-end">
            <Badge
              variant="ember"
              size="md"
              className="border-0 bg-[color:var(--accent-alt)] font-bold text-white shadow-warm"
            >
              🍽️ {chef.daily_special.title} ·{' '}
              {formatNaira(chef.daily_special.price)}
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 p-6">
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <h2 className="truncate font-display text-2xl font-bold text-white">
                  {chef.full_name}
                </h2>
                {chef.is_verified && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-center text-sm font-bold text-[color:var(--success)]">
                    ✓
                  </span>
                )}
                {chef.streak && chef.streak > 2 && (
                  <span className="flex items-center gap-0.5 text-sm font-bold text-[color:var(--accent)]">
                    <Flame className="h-4 w-4 fill-current" /> {chef.streak}
                  </span>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-white/80">
                {chef.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {chef.location}
                  </span>
                )}
                {chef.location && chef.price_min && <span>·</span>}
                {chef.price_min && (
                  <span className="font-semibold text-[color:var(--accent-alt)]">
                    {formatNaira(chef.price_min)}+
                  </span>
                )}
              </div>

              {chef.cuisines && (
                <div className="flex flex-wrap gap-1.5">
                  {chef.cuisines.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-white/10 bg-white/15 px-3 py-0.5 text-xs text-white backdrop-blur-md"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-3 flex flex-col items-end gap-2">
              {chef.rating && (
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/15 px-2.5 py-0.5 backdrop-blur-md">
                  <Star className="h-3.5 w-3.5 fill-[color:var(--accent-alt)] text-[color:var(--accent-alt)]" />
                  <span className="text-xs font-semibold text-white">
                    {chef.rating.toFixed(1)}
                  </span>
                </div>
              )}
              <button
                onClick={onInfo}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-90"
              >
                ⓘ
              </button>
            </div>
          </div>
        </div>
      </div>
    </animated.div>
  )
}
