import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  HeartFilledIcon,
  HeartIcon,
  InfoIcon,
  XIcon,
} from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { useStories, type StoryWithCook } from "../hooks/useStories";
import { useStreak } from "../hooks/useStreak";
import { useSwipe } from "../hooks/useSwipe";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/db";

const formatNaira = (n: number) => {
  if (n >= 1000) return `₦${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `₦${n}`;
};

function RangeSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {label}
        </span>
        <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-sm font-bold text-brand-700 dark:bg-brand-400/20 dark:text-brand-300">
          {display}
        </span>
      </div>
      <div className="relative py-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 dark:text-zinc-500">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

function StoriesStrip({
  stories,
  onSelect,
}: {
  stories: StoryWithCook[];
  onSelect: (s: StoryWithCook) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <div className="-mx-4 mb-3 px-4">
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s) => {
          const name = s.cook?.nickname ?? s.cook?.name ?? "Cook";
          const photo = s.cook?.avatar_url;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className="flex flex-shrink-0 flex-col items-center gap-1"
            >
              <div className="rounded-full bg-gradient-to-br from-brand-400 to-punch-500 p-0.5">
                <div className="rounded-full bg-white p-0.5 dark:bg-slate-950">
                  {photo ? (
                    <img
                      src={photo}
                      alt={name}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-lg font-bold text-slate-600 dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
                      {name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-14 truncate text-center text-[10px] font-semibold leading-tight text-slate-600 dark:text-zinc-400">
                {name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StoryViewer({
  story,
  onClose,
  onLike,
}: {
  story: StoryWithCook;
  onClose: () => void;
  onLike?: () => void;
}) {
  const name = story.cook?.nickname ?? story.cook?.name ?? "Cook";
  const photo = story.cook?.avatar_url;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full gap-6 max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative h-52 bg-black">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover opacity-80"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-500/20 to-punch-500/20">
              <span className="text-6xl">🍽️</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-12">
            <div className="flex items-center gap-2">
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="h-8 w-8 rounded-full border border-white/30 object-cover"
                />
              ) : null}
              <div className="font-bold text-white">{name}</div>
              <span className="rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                Cook
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-8 pt-4">
          <div className="text-xl font-bold text-slate-900 dark:text-zinc-100">
            {story.title}
          </div>
          {story.description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              {story.description}
            </p>
          ) : null}

          {(story.menu_items ?? []).length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Tonight's Menu
              </div>
              <div className="flex flex-wrap gap-2">
                {(story.menu_items ?? []).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-300"
                  >
                    🍽️ {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {onLike ? (
            <button
              type="button"
              onClick={() => {
                onLike();
                onClose();
              }}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 active:scale-95"
            >
              ❤️ Like this cook
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function onlineStatusLabel(lastSeen: string | null | undefined) {
  if (!lastSeen) return null;
  const ms = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 5) return { text: "Online now", dotCls: "bg-green-500" };
  if (mins < 60) return { text: `Active ${mins}m ago`, dotCls: "bg-amber-400" };
  const hours = Math.floor(ms / 3600000);
  if (hours < 24)
    return { text: `Active ${hours}h ago`, dotCls: "bg-slate-400" };
  return null;
}

function ProfileInfoSheet({
  profile,
  photos,
  onClose,
  onLike,
  onSkip,
}: {
  profile: Profile;
  photos: string[];
  onClose: () => void;
  onLike: () => void;
  onSkip: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const status = onlineStatusLabel(profile.last_seen_at);

  const sectionLabel =
    "text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2";
  const tagCls =
    "rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-zinc-200";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[95dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative h-[52vw] max-h-80 min-h-52 flex-shrink-0 overflow-hidden bg-black">
          {photos[photoIdx] ? (
            <img
              src={photos[photoIdx]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No photo
            </div>
          )}

          {photos.length > 1 && (
            <div className="absolute left-0 right-0 top-2 flex gap-1 px-3">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoIdx(idx)}
                  className={[
                    "h-0.5 flex-1 rounded-full transition-all",
                    idx === photoIdx ? "bg-white" : "bg-white/30",
                  ].join(" ")}
                />
              ))}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-0 top-0 h-full w-1/3"
                onClick={() =>
                  setPhotoIdx((i) => (i === 0 ? photos.length - 1 : i - 1))
                }
              />
              <button
                type="button"
                className="absolute right-0 top-0 h-full w-1/3"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
              />
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.47 4.47a.75.75 0 011.06 0L8 6.94l2.47-2.47a.75.75 0 111.06 1.06L9.06 8l2.47 2.47a.75.75 0 11-1.06 1.06L8 9.06l-2.47 2.47a.75.75 0 01-1.06-1.06L6.94 8 4.47 5.53a.75.75 0 010-1.06z" />
            </svg>
          </button>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
            <div className="text-2xl font-bold text-white">
              {profile.name}
              {profile.age != null && (
                <span className="ml-2 text-xl font-semibold opacity-90">
                  {profile.age}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-white/80">
              <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                {profile.role === "cook" ? "Cook" : "Foodie"}
              </span>
              {profile.specialty && (
                <span className="text-white/70">{profile.specialty}</span>
              )}
            </div>
            {status || profile.available_for_parties ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {status && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        status.dotCls,
                      ].join(" ")}
                    />
                    <span className="text-xs font-semibold text-white/85">
                      {status.text}
                    </span>
                  </div>
                )}
                {profile.available_for_parties && (
                  <span className="rounded-full border border-white/25 bg-white/20 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                    🎉 Available for parties
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {profile.role === "cook" &&
            profile.price_min != null &&
            profile.price_max != null && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-500/10 px-4 py-3 dark:bg-brand-400/10">
                <div className="text-2xl">🍽️</div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">
                    Session Rate
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    {formatNaira(profile.price_min)} –{" "}
                    {formatNaira(profile.price_max)}
                  </div>
                </div>
              </div>
            )}

          {profile.bio && (
            <div className="mb-5">
              <div className={sectionLabel}>About</div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                {profile.bio}
              </p>
            </div>
          )}

          {profile.looking_for && (
            <div className="mb-5">
              <div className={sectionLabel}>Looking for</div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {profile.looking_for}
              </p>
            </div>
          )}

          {(profile.cuisines ?? []).length > 0 && (
            <div className="mb-5">
              <div className={sectionLabel}>
                {profile.role === "cook" ? "Cuisines" : "Cuisine Preferences"}
              </div>
              <div className="flex flex-wrap gap-2">
                {(profile.cuisines ?? []).map((c) => (
                  <span key={c} className={tagCls}>
                    🍲 {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(profile.interests ?? []).length > 0 && (
            <div className="mb-5">
              <div className={sectionLabel}>Interests</div>
              <div className="flex flex-wrap gap-2">
                {(profile.interests ?? []).map((t) => (
                  <span key={t} className={tagCls}>
                    ✦ {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(profile.favorite_foods ?? []).length > 0 && (
            <div className="mb-5">
              <div className={sectionLabel}>
                {profile.role === "cook"
                  ? "Signature Dishes"
                  : "Favourite Foods"}
              </div>
              <div className="flex flex-wrap gap-2">
                {(profile.favorite_foods ?? []).map((f) => (
                  <span key={f} className={tagCls}>
                    🔥 {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check out ${profile.name}'s cooking on Food4Love! 🍽️\n${window.location.origin}/cook/${profile.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 py-3 text-sm font-bold text-[#1a9e4a] transition active:scale-95 dark:border-[#25D366]/30 dark:text-[#25D366]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.549 4.103 1.51 5.833L.054 23.394a.75.75 0 00.917.916l5.562-1.456A11.945 11.945 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.75a9.708 9.708 0 01-4.95-1.353l-.354-.211-3.668.96.977-3.565-.229-.368A9.706 9.706 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
            </svg>
            Share {profile.name}'s profile
          </a>

          <div className="h-24" />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-5 border-t border-black/8 bg-white/95 py-4 backdrop-blur dark:border-white/8 dark:bg-slate-950/95">
          <button
            type="button"
            onClick={() => {
              onSkip();
              onClose();
            }}
            className="group flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-400/40 bg-white shadow-lg transition hover:border-red-400 hover:shadow-red-400/20 active:scale-90 dark:bg-slate-900"
          >
            <XIcon className="h-6 w-6 text-red-400 transition group-hover:scale-110" />
          </button>
          <button
            type="button"
            onClick={() => {
              onLike();
              onClose();
            }}
            className="group flex items-center justify-center rounded-full shadow-xl transition hover:scale-105 active:scale-95"
            style={{ width: 72, height: 72, backgroundColor: "#f59e0b" }}
          >
            <HeartFilledIcon className="h-8 w-8 text-white transition group-hover:scale-110" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SwipePage() {
  const { user, profile } = useAuth();

  const [filterRole, setFilterRole] = useState<"all" | "cook" | "buyer">(
    "cook",
  );
  const [maxDistanceKm, setMaxDistanceKm] = useState(40);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(50);
  const [maxPrice, setMaxPrice] = useState(99000);
  const [availableForParties, setAvailableForParties] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [mouseDownX, setMouseDownX] = useState<number | null>(null);
  const [mouseDownY, setMouseDownY] = useState<number | null>(null);
  const [swipeAnim, setSwipeAnim] = useState<"like" | "nope" | null>(null);
  const [selectedStory, setSelectedStory] = useState<StoryWithCook | null>(
    null,
  );
  const [todaySwipes, setTodaySwipes] = useState<number | null>(null);

  const { streak, recordSwipe } = useStreak(user?.id ?? null);
  const { stories } = useStories(user?.id ?? null);

  const { isLoading, activeCook, like, skip, refresh, isExhausted } = useSwipe({
    buyerId: user?.id ?? null,
    buyerProfile: profile,
    filterRole,
    maxDistanceKm,
    minAge,
    maxAge,
    maxPrice,
    availableForParties,
  });

  useEffect(() => {
    if (!isExhausted) return;
    void supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .gte(
        "created_at",
        new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      )
      .then(
        ({ count }) => {
          if (count != null) setTodaySwipes(count);
        },
        () => {},
      );
  }, [isExhausted]);

  const activePhotos = useMemo(() => {
    if (!activeCook) return [];
    const base = [
      activeCook.avatar_url ?? null,
      ...(activeCook.photos ?? []),
    ].filter(Boolean) as string[];
    const unique: string[] = [];
    for (const u of base) {
      if (!unique.includes(u)) unique.push(u);
    }
    return unique.slice(0, 5);
  }, [activeCook]);

  useEffect(() => {
    setPhotoIndex(0);
    setSwipeAnim(null);
    setIsInfoOpen(false);
  }, [activeCook?.id]);

  const applySwipeFromDelta = async (dx: number, dy: number) => {
    if (Math.abs(dx) < 80) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx > 0) {
      setSwipeAnim("like");
      await new Promise((r) => setTimeout(r, 200));
      await like();
    } else {
      setSwipeAnim("nope");
      await new Promise((r) => setTimeout(r, 200));
      await skip();
    }
  };

  const handleLike = async () => {
    setSwipeAnim("like");
    await new Promise((r) => setTimeout(r, 200));
    await like();
    recordSwipe().catch(() => {});
  };

  const handleSkip = async () => {
    setSwipeAnim("nope");
    await new Promise((r) => setTimeout(r, 200));
    await skip();
    recordSwipe().catch(() => {});
  };

  const roleLabel =
    filterRole === "all"
      ? "Cooks + People"
      : filterRole === "cook"
        ? "Cooks"
        : "People";

  return (
    <div className="mx-auto flex gap-6 pb-6 max-w-md flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Food4Love
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {roleLabel} · {maxDistanceKm}km · {minAge}–{maxAge}yrs
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streak && streak.current_streak >= 2 ? (
            <div className="flex items-center gap-1 rounded-full border border-brand-400/30 bg-brand-500/10 px-2.5 py-1.5 text-xs font-bold text-brand-700 dark:bg-brand-400/15 dark:text-brand-300">
              🔥 {streak.current_streak}
            </div>
          ) : null}
          <Link to="/map" className="block">
            <Button variant="secondary" className="px-3 py-2 text-xs">
              Map
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow active:scale-95 dark:border-white/12 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 0 2H2a1 1 0 0 1-1-1zm2 4a1 1 0 0 1 1-1h8a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1zm2 4a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2H6a1 1 0 0 1-1-1z" />
            </svg>
            Filter
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-full border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:shadow active:scale-95 dark:border-white/12 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12"
          >
            ↻
          </button>
        </div>
      </header>

      <StoriesStrip stories={stories} onSelect={setSelectedStory} />

      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-[440px] items-center justify-center">
            <div className="text-sm text-slate-400 dark:text-zinc-500">
              Loading…
            </div>
          </div>
        ) : isExhausted ? (
          <div className="flex h-[440px] flex-col items-center justify-center gap-4 text-center">
            <div className="text-5xl">🍽️</div>
            <div className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              You've seen everyone!
            </div>
            <div className="max-w-xs text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              We're still growing — more cooks are joining every day. Come back
              soon or adjust your filters.
            </div>
            {todaySwipes != null && todaySwipes > 0 ? (
              <div className="rounded-2xl border border-brand-400/20 bg-brand-500/8 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
                🌟 {todaySwipes.toLocaleString()} food lovers active in Lagos
                today
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsFilterOpen(true)}>
                Adjust Filters
              </Button>
              <Button variant="primary" onClick={() => refresh()}>
                Check Again
              </Button>
            </div>
          </div>
        ) : activeCook ? (
          <div
            className="relative"
            style={{
              transform:
                swipeAnim === "like"
                  ? "translateX(60px) rotate(8deg)"
                  : swipeAnim === "nope"
                    ? "translateX(-60px) rotate(-8deg)"
                    : "none",
              opacity: swipeAnim ? 0 : 1,
              transition: swipeAnim ? "all 0.2s ease-out" : "none",
            }}
          >
            <div className="relative overflow-hidden rounded-3xl bg-black shadow-2xl dark:shadow-black/60">
              <div
                className="aspect-[4/5] w-full overflow-hidden"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  setTouchStartX(t?.clientX ?? null);
                  setTouchStartY(t?.clientY ?? null);
                }}
                onTouchEnd={async (e) => {
                  const startX = touchStartX;
                  const startY = touchStartY;
                  setTouchStartX(null);
                  setTouchStartY(null);
                  const t = e.changedTouches[0];
                  if (startX == null || startY == null || !t) return;
                  await applySwipeFromDelta(
                    t.clientX - startX,
                    t.clientY - startY,
                  );
                }}
                onMouseDown={(e) => {
                  setMouseDownX(e.clientX);
                  setMouseDownY(e.clientY);
                }}
                onMouseUp={async (e) => {
                  const startX = mouseDownX;
                  const startY = mouseDownY;
                  setMouseDownX(null);
                  setMouseDownY(null);
                  if (startX == null || startY == null) return;
                  await applySwipeFromDelta(
                    e.clientX - startX,
                    e.clientY - startY,
                  );
                }}
              >
                {activePhotos[photoIndex] ? (
                  <img
                    src={activePhotos[photoIndex]}
                    alt=""
                    className="h-full w-full select-none object-cover"
                    draggable={false}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-sm text-slate-400">
                    No photo yet
                  </div>
                )}

                {activePhotos.length > 1 && (
                  <div className="absolute left-0 right-0 top-2 flex gap-1 px-2">
                    {activePhotos.map((_, idx) => (
                      <div
                        key={idx}
                        className={[
                          "h-0.5 flex-1 rounded-full transition-all",
                          idx === photoIndex ? "bg-white" : "bg-white/30",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                )}

                {activePhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-0 top-0 h-full w-1/2"
                      onClick={() =>
                        setPhotoIndex((i) =>
                          i === 0 ? activePhotos.length - 1 : i - 1,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 h-full w-1/2"
                      onClick={() =>
                        setPhotoIndex((i) => (i + 1) % activePhotos.length)
                      }
                    />
                  </>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-5 pt-16">
                  {activeCook.daily_special &&
                  activeCook.daily_special_until &&
                  new Date(activeCook.daily_special_until) > new Date() ? (
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/95 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm backdrop-blur-sm">
                      🍽️ Today: {activeCook.daily_special}
                    </div>
                  ) : null}
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {activeCook.name}
                        {activeCook.age != null ? (
                          <span className="ml-2 text-xl font-semibold opacity-90">
                            {activeCook.age}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-white/80">
                        {activeCook.role === "cook" ? "Cook" : "Foodie"}
                        {activeCook.specialty
                          ? ` · ${activeCook.specialty}`
                          : ""}
                        {activeCook.role === "cook" &&
                        activeCook.price_min != null &&
                        activeCook.price_max != null
                          ? ` · ${formatNaira(activeCook.price_min)}–${formatNaira(activeCook.price_max)}`
                          : ""}
                      </div>
                      {activeCook.bio ? (
                        <div className="mt-1.5 line-clamp-2 text-sm leading-snug text-white/70">
                          {activeCook.bio}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsInfoOpen(true)}
                      className="group mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/15 backdrop-blur-sm transition hover:bg-white/25 active:scale-90"
                    >
                      <InfoIcon className="h-5 w-5 text-white transition group-hover:scale-110" />
                    </button>
                  </div>

                  {((activeCook.cuisines ?? []).length > 0 ||
                    (activeCook.interests ?? []).length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(activeCook.cuisines ?? []).slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
                        >
                          {t}
                        </span>
                      ))}
                      {(activeCook.interests ?? []).slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-shrink-0 items-center pb-6 justify-center gap-6 py-3 sm:mt-5">
        <button
          type="button"
          onClick={handleSkip}
          disabled={!activeCook || isLoading || isExhausted}
          className="group flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-red-400/40 bg-white shadow-lg transition hover:border-red-400 hover:shadow-lg hover:shadow-red-400/20 active:scale-90 disabled:pointer-events-none disabled:opacity-30 dark:bg-slate-900 dark:hover:shadow-red-400/15"
        >
          <XIcon className="h-7 w-7 text-red-400 transition group-hover:scale-110" />
        </button>

        <button
          type="button"
          onClick={handleLike}
          disabled={!activeCook || isLoading || isExhausted}
          className="group flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/30 transition hover:scale-105 hover:shadow-2xl hover:shadow-brand-500/40 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <HeartIcon className="h-9 w-9 text-white transition group-hover:scale-110" />
        </button>

        <button
          type="button"
          disabled={!activeCook || isLoading || isExhausted}
          onClick={() => setIsInfoOpen(true)}
          className="group flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-sky-400/40 bg-white shadow-lg transition hover:border-sky-400 hover:shadow-lg hover:shadow-sky-400/20 active:scale-90 disabled:pointer-events-none disabled:opacity-30 dark:bg-slate-900 dark:hover:shadow-sky-400/15"
        >
          <InfoIcon className="h-6 w-6 text-sky-400 transition group-hover:scale-110" />
        </button>
      </div>

      {isInfoOpen && activeCook ? (
        <ProfileInfoSheet
          profile={activeCook}
          photos={activePhotos}
          onClose={() => setIsInfoOpen(false)}
          onLike={handleLike}
          onSkip={handleSkip}
        />
      ) : null}

      {selectedStory ? (
        <StoryViewer
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onLike={
            selectedStory.cook_id !== user?.id
              ? () => {
                  handleLike().catch(() => {});
                  setSelectedStory(null);
                }
              : undefined
          }
        />
      ) : null}

      {isFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFilterOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsFilterOpen(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border-t border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/10 dark:bg-white/10" />

            <div className="px-5 pb-8 pt-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    Discovery Settings
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    Swipe smarter, eat better
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="rounded-full bg-black/6 p-2 text-slate-600 transition hover:bg-black/10 active:scale-90 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M4.47 4.47a.75.75 0 011.06 0L8 6.94l2.47-2.47a.75.75 0 111.06 1.06L9.06 8l2.47 2.47a.75.75 0 11-1.06 1.06L8 9.06l-2.47 2.47a.75.75 0 01-1.06-1.06L6.94 8 4.47 5.53a.75.75 0 010-1.06z" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="mb-3 text-sm font-bold text-slate-700 dark:text-zinc-200">
                    Show Me
                  </div>
                  <div className="flex rounded-2xl border border-black/8 bg-black/4 p-1 dark:border-white/8 dark:bg-white/4">
                    {(
                      [
                        { v: "cook", label: "Cooks" },
                        { v: "all", label: "Everyone" },
                        { v: "buyer", label: "Buyers" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFilterRole(opt.v)}
                        className={[
                          "flex-1 rounded-xl py-2.5 text-sm font-semibold transition active:scale-95",
                          filterRole === opt.v
                            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-zinc-100"
                            : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <RangeSlider
                  label="Maximum Distance"
                  min={1}
                  max={40}
                  step={1}
                  value={maxDistanceKm}
                  onChange={setMaxDistanceKm}
                  format={(v) => `${v} km`}
                />

                <div>
                  <div className="mb-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
                    Age Range
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <RangeSlider
                      label="Min"
                      min={18}
                      max={60}
                      step={1}
                      value={minAge}
                      onChange={(v) => {
                        setMinAge(v);
                        if (v > maxAge) setMaxAge(v);
                      }}
                      format={(v) => `${v}`}
                    />
                    <RangeSlider
                      label="Max"
                      min={18}
                      max={60}
                      step={1}
                      value={maxAge}
                      onChange={(v) => {
                        setMaxAge(v);
                        if (v < minAge) setMinAge(v);
                      }}
                      format={(v) => `${v}`}
                    />
                  </div>
                </div>

                <RangeSlider
                  label="Max Budget"
                  min={1000}
                  max={99000}
                  step={500}
                  value={maxPrice}
                  onChange={setMaxPrice}
                  format={formatNaira}
                />

                <div>
                  <div className="mb-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
                    Events & Parties
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvailableForParties(!availableForParties)}
                    className={[
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-95",
                      availableForParties
                        ? "border-brand-400/50 bg-brand-500/10 text-brand-700 dark:border-brand-400/40 dark:bg-brand-500/12 dark:text-brand-300"
                        : "border-black/10 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-zinc-300",
                    ].join(" ")}
                  >
                    <span>🎉 Available for parties</span>
                    {availableForParties ? (
                      <span className="text-brand-600 dark:text-brand-400">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterRole("cook");
                      setMaxDistanceKm(40);
                      setMinAge(18);
                      setMaxAge(50);
                      setMaxPrice(99000);
                      setAvailableForParties(false);
                    }}
                    className="flex-1 rounded-2xl border border-black/10 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-black/4 active:scale-95 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/6"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 active:scale-95"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
