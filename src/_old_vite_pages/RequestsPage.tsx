import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { HeartIcon, XIcon } from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { Like, Match, Profile } from "../types/db";

const MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;

type LikeWithProfile = Like & { buyerProfile: Profile | null };

function Avatar({ src, name }: { src: string | null | undefined; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-punch-500 text-2xl font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function RequestsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<LikeWithProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const [likesResult, matchesResult] = await Promise.all([
        supabase
          .from("likes")
          .select("*")
          .eq("cook_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("matches")
          .select("*")
          .eq("cook_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const likeRows = (likesResult.data as Like[]) ?? [];
      const matchRows = (matchesResult.data as Match[]) ?? [];
      setMatches(matchRows);

      const buyerIds = likeRows.map((l) => l.buyer_id).filter(Boolean);
      let profilesById = new Map<string, Profile>();
      if (buyerIds.length > 0) {
        const { data: pRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", buyerIds);
        profilesById = new Map(
          ((pRows as Profile[]) ?? []).map((p) => [p.id, p]),
        );
      }

      setItems(
        likeRows.map((l) => ({
          ...l,
          buyerProfile: profilesById.get(l.buyer_id) ?? null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const accept = async (like: Like) => {
    setError(null);
    try {
      if (profile?.kyc_status !== "verified") {
        navigate("/kyc", { state: { from: "/requests" } });
        return;
      }
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

  const reject = async (like: Like) => {
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

  if (profile?.role === "cook" && profile.kyc_status !== "verified") {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
        <header className="mb-5">
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Requests
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Verify identity to accept
          </div>
        </header>
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 text-center">
          <div className="text-3xl">🪪</div>
          <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Identity verification needed
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Verify once to start accepting match requests and unlocking chats.
          </div>
          <button
            type="button"
            onClick={() => navigate("/kyc", { state: { from: "/requests" } })}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition active:scale-95"
          >
            Verify Identity
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Requests
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {items.length > 0
              ? `${items.length} buyer${items.length > 1 ? "s" : ""} want your cooking`
              : "Pending booking requests"}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/likes">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white dark:border-white/12 dark:bg-white/8 dark:text-zinc-300"
            >
              History
            </button>
          </Link>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white active:scale-95 dark:border-white/12 dark:bg-white/8 dark:text-zinc-300"
          >
            ↻
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-slate-500 dark:text-zinc-400">Loading…</div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl">🧑‍🍳</div>
          <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
            No requests yet
          </div>
          <div className="max-w-xs text-sm text-slate-500 dark:text-zinc-400">
            Complete your cook profile and post a story to attract buyers.
          </div>
          <Link to="/onboarding/cook">
            <Button variant="primary" className="mt-2">
              Update Cook Profile
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const p = item.buyerProfile;
          const name = p?.nickname ?? p?.name ?? "Someone";
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900"
            >
              <div className="flex items-start gap-3 p-4">
                <Avatar src={p?.avatar_url} name={name} />
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
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(p?.cuisines ?? []).slice(0, 2).map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300"
                      >
                        {c}
                      </span>
                    ))}
                    {(p?.interests ?? []).slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-punch-500/8 px-2 py-0.5 text-[10px] font-semibold text-punch-700 dark:text-punch-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                    Sent {timeAgo(item.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 border-t border-black/6 px-4 py-3 dark:border-white/6">
                <button
                  type="button"
                  onClick={() => reject(item)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 py-2.5 text-sm font-semibold text-red-500 transition hover:border-red-400 hover:bg-red-50 active:scale-95 dark:hover:bg-red-500/10"
                >
                  <XIcon className="h-4 w-4" />
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => accept(item)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/25 transition hover:from-brand-600 active:scale-95"
                >
                  <HeartIcon className="h-4 w-4" />
                  Accept Match
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {matches.length > 0 && !isLoading ? (
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Active matches — {matches.length}
          </div>
          <Link to="/matches">
            <button
              type="button"
              className="w-full rounded-2xl border border-brand-400/30 bg-brand-500/8 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-500/15 active:scale-95 dark:bg-brand-400/10 dark:text-brand-300"
            >
              Open Chats →
            </button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
