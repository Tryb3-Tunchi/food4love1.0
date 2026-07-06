import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { Match, Profile } from "../types/db";

type MatchWithProfile = Match & { otherProfile: Profile | null };

function Avatar({ src, name }: { src: string | null | undefined; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-punch-500 text-xl font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function expiryInfo(expiresAt: string | null): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", urgent: false };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return null;
  const label = h > 0 ? `${h}h ${m}m to respond` : `${m}m to respond`;
  return { label, urgent: h < 6 };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export function MatchesPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<MatchWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: matchRows, error: mErr } = await supabase
        .from("matches")
        .select("*")
        .or(`buyer_id.eq.${user.id},cook_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;

      const rows = (matchRows as Match[]) ?? [];
      const otherIds = rows.map((m) =>
        m.buyer_id === user.id ? m.cook_id : m.buyer_id,
      );

      let profilesById = new Map<string, Profile>();
      if (otherIds.length > 0) {
        const { data: pRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", otherIds);
        profilesById = new Map(
          ((pRows as Profile[]) ?? []).map((p) => [p.id, p]),
        );
      }

      setItems(
        rows.map((m) => ({
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
  }, [user?.id]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const active = items.filter((m) => {
    if (!m.expires_at) return true;
    return new Date(m.expires_at).getTime() > Date.now();
  });

  const expired = items.filter((m) => {
    if (!m.expires_at) return false;
    return new Date(m.expires_at).getTime() <= Date.now();
  });

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Chats
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Chat unlocks when you match
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

      {isLoading ? (
        <div className="text-sm text-slate-500 dark:text-zinc-400">Loading…</div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl">💬</div>
          <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
            No matches yet
          </div>
          <div className="max-w-xs text-sm text-slate-500 dark:text-zinc-400">
            When you both like each other, a match is made and the chat unlocks.
          </div>
          <Link to="/swipe">
            <button
              type="button"
              className="mt-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-600 active:scale-95"
            >
              Discover Cooks
            </button>
          </Link>
        </div>
      ) : null}

      <div className="space-y-2">
        {active.map((m) => {
          const p = m.otherProfile;
          const name = p?.nickname ?? p?.name ?? "Match";
          const expiry = expiryInfo(m.expires_at);
          return (
            <Link key={m.id} to={`/chat/${m.id}`} className="block">
              <div className="flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm transition hover:bg-brand-500/[0.03] active:scale-[0.98] dark:border-white/[0.06] dark:bg-slate-900 dark:hover:bg-white/[0.03]">
                <div className="relative">
                  <Avatar src={p?.avatar_url} name={name} />
                  <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {name}
                    {p?.age ? (
                      <span className="ml-1 font-normal text-slate-500 dark:text-zinc-400">
                        {p.age}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                    {p?.role === "cook" ? "Cook" : "Foodie"}
                    {p?.specialty ? ` · ${p.specialty}` : ""}
                    {p?.price_min != null && p?.price_max != null
                      ? ` · ₦${Math.round(p.price_min / 1000)}k–₦${Math.round(p.price_max / 1000)}k`
                      : ""}
                  </div>
                  {expiry ? (
                    <div
                      className={[
                        "mt-1 text-[11px] font-semibold",
                        expiry.urgent
                          ? "text-red-500 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400",
                      ].join(" ")}
                    >
                      ⏰ {expiry.label}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                      Matched {timeAgo(m.created_at)}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                  Open →
                </div>
              </div>
            </Link>
          );
        })}

        {expired.length > 0 ? (
          <>
            <div className="pt-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Expired
              </div>
            </div>
            {expired.map((m) => {
              const p = m.otherProfile;
              const name = p?.nickname ?? p?.name ?? "Match";
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 rounded-2xl border border-black/6 bg-black/3 p-4 opacity-50 dark:border-white/6 dark:bg-white/[0.02]"
                >
                  <Avatar src={p?.avatar_url} name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      {name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                      Match expired
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
