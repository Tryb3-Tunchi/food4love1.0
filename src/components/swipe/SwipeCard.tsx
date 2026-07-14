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
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-card shadow-float">
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
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--app-bg-3)]">
            <Avatar
              src={chef.avatar_url}
              name={chef.full_name ?? chef.name ?? ''}
              size="2xl"
            />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* LIKE stamp */}
        <animated.div
          style={{ opacity: likeOpacity }}
          className="absolute left-6 top-10 rotate-[-20deg] rounded-xl border-4 border-lime px-4 py-1"
        >
          <span className="text-2xl font-black tracking-widest text-lime">
            LIKE
          </span>
        </animated.div>

        {/* PASS stamp */}
        <animated.div
          style={{ opacity: passOpacity }}
          className="absolute right-6 top-10 rotate-[20deg] rounded-xl border-4 border-red-400 px-4 py-1"
        >
          <span className="text-2xl font-black tracking-widest text-red-400">
            PASS
          </span>
        </animated.div>

        {/* Daily special */}
        {chef.daily_special && (
          <div className="absolute left-4 right-4 top-4 flex justify-end">
            <Badge
              variant="ember"
              size="md"
              className="shadow-glow-ember border-0 bg-ember text-white"
            >
              🍽 {chef.daily_special.title} ·{' '}
              {formatNaira(chef.daily_special.price)}
            </Badge>
          </div>
        )}

        {/* Info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-white">
                  {chef.full_name}
                </h2>
                {chef.is_verified && (
                  <span className="text-sm text-lime">✓</span>
                )}
                {chef.streak && chef.streak > 2 && (
                  <span className="flex items-center gap-0.5 text-sm font-bold text-ember">
                    <Flame className="h-3.5 w-3.5" /> {chef.streak}
                  </span>
                )}
              </div>
              <div className="mb-2 flex items-center gap-1.5 text-sm text-white/70">
                {chef.location && (
                  <>
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{chef.location}</span>
                    <span>·</span>
                  </>
                )}
                {chef.price_min && (
                  <span className="font-medium text-ember">
                    {formatNaira(chef.price_min)}+
                  </span>
                )}
              </div>
              {chef.cuisines && (
                <div className="flex flex-wrap gap-1.5">
                  {chef.cuisines.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white backdrop-blur-sm"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-3 flex flex-col items-end gap-1">
              {chef.rating && (
                <div className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 fill-ember text-ember" />
                  <span className="text-xs font-semibold text-white">
                    {chef.rating.toFixed(1)}
                  </span>
                </div>
              )}
              <button
                onClick={onInfo}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg text-white backdrop-blur-sm transition-all hover:bg-white/30"
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
