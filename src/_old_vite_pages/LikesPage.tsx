import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeartIcon, XIcon } from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { Like, Match, Profile, Swipe } from "../types/db";

const MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;

const expiryLabel = (expiresAt: string | null): string | null => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return null;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};

function Avatar({
  src,
  name,
  size = "md",
}: {
  src: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const text =
    size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} flex-shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-punch-500 ${text} font-bold text-white`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function LikesPage() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [likes, setLikes] = useState<(Like & { otherProfile: Profile | null })[]>([]);
  const [likedYou, setLikedYou] = useState<(Swipe & { otherProfile: Profile | null })[]>([]);
  const [matches, setMatches] = useState<(Match & { otherProfile: Profile | null })[]>([]);

  const refresh = useCallback(async () => {
    if (!user?.id || !profile) {
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const [swipesResult, likesResult, matchesResult] = await Promise.all([
        supabase
          .from("swipes")
          .select("*")
          .eq("target_id", user.id)
          .eq("direction", "like")
          .order("created_at", { ascending: false }),
        profile.role === "cook"
          ? supabase
              .from("likes")
              .select("*")
              .eq("cook_id", user.id)
              .order("created_at", { ascending: false })
          : supabase
              .from("likes")
              .select("*")
              .eq("buyer_id", user.id)
              .order("created_at", { ascending: false }),
        supabase
          .from("matches")
          .select("*")
          .or(`buyer_id.eq.${user.id},cook_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
      ]);

      const swipeRows = (swipesResult.data as Swipe[]) ?? [];
      const likeRows = (likesResult.data as Like[]) ?? [];
      const matchRows = (matchesResult.data as Match[]) ?? [];

      const allIds = Array.from(
        new Set([
          ...swipeRows.map((s) => s.swiper_id),
          ...likeRows.map((l) =>
            profile.role === "cook" ? l.buyer_id : l.cook_id,
          ),
          ...matchRows.map((m) =>
            m.buyer_id === user.id ? m.cook_id : m.buyer_id,
          ),
        ]),
      );

      let profilesById = new Map<string, Profile>();
      if (allIds.length > 0) {
        const { data: pRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", allIds);
        profilesById = new Map(
          ((pRows as Profile[]) ?? []).map((p) => [p.id, p]),
        );
      }

      setLikedYou(
        swipeRows.map((s) => ({
          ...s,
          otherProfile: profilesById.get(s.swiper_id) ?? null,
        })),
      );

      setLikes(
        likeRows.map((l) => ({
          ...l,
          otherProfile: profilesById.get(
            profile.role === "cook" ? l.buyer_id : l.cook_id,
          ) ?? null,
        })),
      );

      setMatches(
        matchRows.map((m) => ({
          ...m,
          otherProfile:
            profilesById.get(
              m.buyer_id === user.id ? m.cook_id : m.buyer_id,
            ) ?? null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const acceptLike = async (like: Like) => {
    setError(null);
    try {
      const expiresAt = new Date(Date.now() + MATCH_EXPIRY_MS).toISOString();
      const { error: mErr } = await supabase.from("matches").insert({
        buyer_id: like.buyer_id,
        cook_id: like.cook_id,
        expires_at: expiresAt,
      });
      if (mErr) throw mErr;
      await supabase
        .from("likes")
        .update({ status: "accepted" })
        .eq("id", like.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    }
  };

  const rejectLike = async (like: Like) => {
    setError(null);
    try {
      await supabase
        .from("likes")
        .update({ status: "rejected" })
        .eq("id", like.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const likeBack = async (targetId: string) => {
    if (!user?.id || !profile) return;
    setError(null);
    try {
      await supabase.from("swipes").upsert({
        swiper_id: user.id,
        target_id: targetId,
        direction: "like",
      });
      const target = likedYou.find((x) => x.swiper_id === targetId)?.otherProfile;
      if (target?.role === "cook") {
        await supabase.from("likes").upsert({
          buyer_id: user.id,
          cook_id: targetId,
          status: "pending",
        });
      } else {
        const a = user.id < targetId ? user.id : targetId;
        const b = user.id < targetId ? targetId : user.id;
        const expiresAt = new Date(Date.now() + MATCH_EXPIRY_MS).toISOString();
        await supabase.from("matches").upsert({
          buyer_id: a,
          cook_id: b,
          expires_at: expiresAt,
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const matchIdForLike = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      const otherId = m.buyer_id === user?.id ? m.cook_id : m.buyer_id;
      map.set(otherId, m.id);
    }
    return map;
  }, [matches, user?.id]);

  const pendingLikes = useMemo(
    () => likes.filter((l) => l.status === "pending"),
    [likes],
  );

  const isCook = profile?.role === "cook";

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
        <div className="text-sm text-slate-500 dark:text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {isCook ? "Requests" : "Likes"}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {isCook
              ? "People who want your cooking"
              : "People who liked you · your activity"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white active:scale-95 dark:border-white/12 dark:bg-white/8 dark:text-zinc-300"
        >
          ↻
        </button>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        {isCook ? (
          <>
            <section>
              <SectionHeader
                emoji="🔔"
                title="New Requests"
                count={pendingLikes.length}
              />
              {pendingLikes.length === 0 ? (
                <EmptyState
                  emoji="🍽️"
                  message="No requests yet. Make sure your profile is complete so buyers can find you!"
                />
              ) : (
                <div className="space-y-3">
                  {pendingLikes.map((like) => {
                    const p = like.otherProfile;
                    const name = p?.nickname ?? p?.name ?? "Someone";
                    return (
                      <div
                        key={like.id}
                        className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900"
                      >
                        <div className="flex items-start gap-3 p-4">
                          <Avatar src={p?.avatar_url} name={name} size="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                                {name}
                                {p?.age ? (
                                  <span className="ml-1 font-normal text-slate-500 dark:text-zinc-400">
                                    {p.age}
                                  </span>
                                ) : null}
                              </div>
                              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/8 dark:text-zinc-300">
                                Buyer
                              </span>
                            </div>
                            {p?.bio ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                                {p.bio}
                              </p>
                            ) : null}
                            {(p?.cuisines ?? []).length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(p?.cuisines ?? []).slice(0, 3).map((c) => (
                                  <span
                                    key={c}
                                    className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2 border-t border-black/6 px-4 py-3 dark:border-white/6">
                          <button
                            type="button"
                            onClick={() => rejectLike(like)}
                            className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 py-2.5 text-sm font-semibold text-red-500 transition hover:border-red-400 hover:bg-red-50 active:scale-95 dark:hover:bg-red-500/10"
                          >
                            <XIcon className="h-4 w-4" />
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => acceptLike(like)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/25 transition hover:from-brand-600 hover:to-brand-700 active:scale-95"
                          >
                            <HeartIcon className="h-4 w-4" />
                            Accept Match
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                emoji="✅"
                title="Matched"
                count={matches.length}
              />
              {matches.length === 0 ? (
                <EmptyState
                  emoji="💬"
                  message="When you accept a request, the chat unlocks. Check back!"
                />
              ) : (
                <div className="space-y-2">
                  {matches.map((m) => {
                    const p = m.otherProfile;
                    const name = p?.nickname ?? p?.name ?? "Someone";
                    const expiry = expiryLabel(m.expires_at);
                    return (
                      <MatchCard
                        key={m.id}
                        matchId={m.id}
                        profile={p}
                        name={name}
                        expiry={expiry}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section>
              <SectionHeader
                emoji="❤️"
                title="Liked You"
                count={likedYou.length}
              />
              {likedYou.length === 0 ? (
                <EmptyState
                  emoji="🧑‍🍳"
                  message="No one has liked you yet. Keep swiping to get noticed!"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {likedYou.map((s) => {
                    const p = s.otherProfile;
                    const name = p?.nickname ?? p?.name ?? "Someone";
                    const matchId = matchIdForLike.get(s.swiper_id);
                    const alreadyMatched = Boolean(matchId);

                    return (
                      <div
                        key={s.id}
                        className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900"
                      >
                        <div className="relative aspect-[3/4] bg-slate-200 dark:bg-slate-800">
                          {p?.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-4xl font-bold text-slate-400 dark:text-slate-600">
                              {name.charAt(0)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
                            <div className="text-sm font-bold text-white">
                              {name}
                              {p?.age ? (
                                <span className="ml-1 font-normal opacity-80">
                                  {p.age}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-white/70">
                              {p?.role === "cook" ? "Cook" : "Foodie"}
                              {p?.specialty ? ` · ${p.specialty}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="p-2">
                          {alreadyMatched ? (
                            <Link to={`/chat/${matchId}`} className="block">
                              <button
                                type="button"
                                className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
                              >
                                💬 Chat
                              </button>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => likeBack(s.swiper_id)}
                              className="w-full rounded-xl border border-brand-400/30 bg-brand-500/8 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-500/15 active:scale-95 dark:bg-brand-400/10 dark:text-brand-300"
                            >
                              ❤️ Like Back
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                emoji="⏳"
                title="Your Likes"
                count={likes.filter((l) => l.status === "pending").length}
              />
              {likes.length === 0 ? (
                <EmptyState
                  emoji="🔍"
                  message="Start swiping to send likes. Your activity will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {likes.map((like) => {
                    const p = like.otherProfile;
                    const name = p?.nickname ?? p?.name ?? "Someone";
                    const matchId = matchIdForLike.get(
                      profile?.role === "cook" ? like.buyer_id : like.cook_id,
                    );
                    const expiry = expiryLabel(
                      matches.find((m) => m.id === matchId)?.expires_at ?? null,
                    );

                    return (
                      <div
                        key={like.id}
                        className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3 shadow-sm dark:border-white/[0.06] dark:bg-slate-900"
                      >
                        <Avatar src={p?.avatar_url} name={name} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                            {name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StatusDot status={like.status} />
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                              {like.status === "pending"
                                ? "Waiting for response"
                                : like.status === "accepted"
                                  ? "Matched!"
                                  : "Passed"}
                            </span>
                          </div>
                          {expiry && like.status === "accepted" ? (
                            <div className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              ⏰ {expiry}
                            </div>
                          ) : null}
                        </div>
                        {like.status === "accepted" && matchId ? (
                          <Link to={`/chat/${matchId}`}>
                            <button
                              type="button"
                              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:from-brand-600 active:scale-95"
                            >
                              Chat
                            </button>
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {matches.length > 0 ? (
              <section>
                <SectionHeader
                  emoji="🎉"
                  title="Matches"
                  count={matches.length}
                />
                <div className="space-y-2">
                  {matches.map((m) => {
                    const p = m.otherProfile;
                    const name = p?.nickname ?? p?.name ?? "Someone";
                    const expiry = expiryLabel(m.expires_at);
                    return (
                      <MatchCard
                        key={m.id}
                        matchId={m.id}
                        profile={p}
                        name={name}
                        expiry={expiry}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

function SectionHeader({
  emoji,
  title,
  count,
}: {
  emoji: string;
  title: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
        {title}
      </span>
      {count > 0 ? (
        <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-400/20 dark:text-brand-300">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-black/2 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <div className="text-3xl">{emoji}</div>
      <div className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
        {message}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Like["status"] }) {
  const cls =
    status === "accepted"
      ? "bg-green-500"
      : status === "pending"
        ? "bg-amber-400"
        : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function MatchCard({
  matchId,
  profile: p,
  name,
  expiry,
}: {
  matchId: string;
  profile: Profile | null;
  name: string;
  expiry: string | null;
}) {
  return (
    <Link to={`/chat/${matchId}`} className="block">
      <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3 shadow-sm transition hover:bg-brand-500/[0.03] active:scale-[0.98] dark:border-white/[0.06] dark:bg-slate-900 dark:hover:bg-brand-400/[0.05]">
        <div className="relative">
          <Avatar src={p?.avatar_url} name={name} size="md" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-900" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            {name}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {p?.role === "cook" ? "Cook" : "Foodie"}
            {p?.specialty ? ` · ${p.specialty}` : ""}
          </div>
          {expiry ? (
            <div className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              ⏰ {expiry}
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0">
          <div className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            Chat →
          </div>
        </div>
      </div>
    </Link>
  );
}
