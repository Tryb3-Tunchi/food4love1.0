"use client";
import { useSpring, animated } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import Image from "next/image";
import { MapPin, Star, Flame } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatNaira } from "@/lib/utils";
import { Profile } from "@/types/db";

interface SwipeCardProps {
  chef: Profile;
  onLike: () => void;
  onPass: () => void;
  onInfo: () => void;
  isTop: boolean;
}

export function SwipeCard({ chef, onLike, onPass, onInfo, isTop }: SwipeCardProps) {
  const [{ x, rotate, scale, opacity }, api] = useSpring(() => ({
    x: 0, rotate: 0, scale: isTop ? 1 : 0.95, opacity: 1,
    config: { tension: 300, friction: 20 },
  }));

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], last }) => {
      if (!isTop) return;
      const trigger = Math.abs(mx) > 120 || (last && Math.abs(vx) > 0.5);
      if (last && trigger) {
        api.start({ x: dx > 0 ? 1000 : -1000, rotate: dx > 0 ? 30 : -30, opacity: 0, config: { tension: 200, friction: 15 } });
        setTimeout(() => { dx > 0 ? onLike() : onPass(); }, 300);
      } else {
        api.start({ x: active ? mx : 0, rotate: active ? mx / 18 : 0, scale: active ? 1.03 : isTop ? 1 : 0.95, immediate: (key) => active && (key === "x" || key === "rotate") });
      }
    },
    { filterTaps: true, bounds: { left: -500, right: 500 }, rubberband: true }
  );

  const likeOpacity = x.to({ range: [-120, 0, 120], output: [0, 0, 1] });
  const passOpacity = x.to({ range: [-120, 0, 120], output: [1, 0, 0] });
  const photo = chef.photos?.[0] ?? chef.avatar_url;

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      style={{ x, rotate, scale, opacity, touchAction: "none" }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-float bg-smoke">
        {photo ? (
          <Image src={photo} alt={chef.full_name} fill className="object-cover pointer-events-none" sizes="(max-width: 500px) 100vw, 500px" priority={isTop} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ember/30 to-pepper/30 flex items-center justify-center">
            <Avatar src={chef.avatar_url} name={chef.full_name} size="2xl" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* LIKE stamp */}
        <animated.div style={{ opacity: likeOpacity }} className="absolute top-10 left-6 rotate-[-20deg] border-4 border-lime rounded-xl px-4 py-1">
          <span className="text-lime text-2xl font-black tracking-widest">LIKE</span>
        </animated.div>

        {/* PASS stamp */}
        <animated.div style={{ opacity: passOpacity }} className="absolute top-10 right-6 rotate-[20deg] border-4 border-red-400 rounded-xl px-4 py-1">
          <span className="text-red-400 text-2xl font-black tracking-widest">PASS</span>
        </animated.div>

        {/* Daily special */}
        {chef.daily_special && (
          <div className="absolute top-4 left-4 right-4 flex justify-end">
            <Badge variant="ember" size="md" className="bg-ember text-white border-0 shadow-glow-ember">
              🍽 {chef.daily_special.title} · {formatNaira(chef.daily_special.price)}
            </Badge>
          </div>
        )}

        {/* Info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white truncate">{chef.full_name}</h2>
                {chef.is_verified && <span className="text-lime text-sm">✓</span>}
                {chef.streak && chef.streak > 2 && (
                  <span className="flex items-center gap-0.5 text-ember text-sm font-bold">
                    <Flame className="h-3.5 w-3.5" /> {chef.streak}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-white/70 text-sm mb-2">
                {chef.location && <><MapPin className="h-3.5 w-3.5" /><span>{chef.location}</span><span>·</span></>}
                {chef.price_min && <span className="text-ember font-medium">{formatNaira(chef.price_min)}+</span>}
              </div>
              {chef.cuisines && (
                <div className="flex flex-wrap gap-1.5">
                  {chef.cuisines.slice(0, 3).map((c) => (
                    <span key={c} className="text-xs bg-white/20 backdrop-blur-sm text-white rounded-full px-2.5 py-0.5">{c}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 ml-3">
              {chef.rating && (
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Star className="h-3.5 w-3.5 fill-ember text-ember" />
                  <span className="text-white text-xs font-semibold">{chef.rating.toFixed(1)}</span>
                </div>
              )}
              <button onClick={onInfo} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all text-white text-lg">ⓘ</button>
            </div>
          </div>
        </div>
      </div>
    </animated.div>
  );
}
