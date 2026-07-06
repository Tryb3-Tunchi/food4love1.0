import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { useStories } from "../hooks/useStories";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/db";

type Row = Profile;
type AdminTab = "overview" | "cooks" | "buyers" | "stories";

export function AdminPage() {
  const { user, profile } = useAuth();
  const { stories, deleteStory, refresh: refreshStories } = useStories(user?.id ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [seedRole, setSeedRole] = useState<"cook" | "buyer" | "both">("both");
  const [seedCount, setSeedCount] = useState(12);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }
    setItems((data as Row[]) ?? []);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [
        p.id,
        p.name,
        p.nickname ?? "",
        p.phone ?? "",
        p.role,
        p.is_bot ? "bot" : "",
        p.is_admin ? "admin" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const cooks = useMemo(() => filtered.filter((p) => p.role === "cook"), [filtered]);
  const buyers = useMemo(() => filtered.filter((p) => p.role === "buyer"), [filtered]);

  const totalCooks = items.filter((p) => p.role === "cook").length;
  const totalBuyers = items.filter((p) => p.role === "buyer").length;
  const totalBots = items.filter((p) => p.is_bot).length;
  const totalVerified = items.filter((p) => p.kyc_status === "verified").length;

  const update = async (id: string, patch: Partial<Row>) => {
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setItems((prev) => prev.map((p) => (p.id === id ? (data as Row) : p)));
  };

  const deleteAccount = async (id: string) => {
    setIsDeleting(true);
    setError(null);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const seedBots = async () => {
    setError(null);
    setIsSeeding(true);
    try {
      const cooks = seedRole === "cook" ? seedCount : seedRole === "both" ? seedCount : 0;
      const buyers = seedRole === "buyer" ? seedCount : seedRole === "both" ? seedCount : 0;
      const { error } = await supabase.functions.invoke("admin-seed", {
        body: { cooks, buyers },
      });
      if (error) throw error;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSeeding(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Admin only
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
            Your account does not have admin access.
          </div>
          <div className="mt-3">
            <Link to="/">
              <Button className="w-full" variant="secondary">
                Back
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "cooks", label: `Cooks (${totalCooks})` },
    { key: "buyers", label: `Buyers (${totalBuyers})` },
    { key: "stories", label: `Stories (${stories.length})` },
  ];

  const tableRows = activeTab === "cooks" ? cooks : buyers;

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Admin Panel
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            Manage users, bots, KYC, and stories
          </div>
        </div>
        <Link to="/">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { label: "Total", value: items.length, color: "bg-slate-100 dark:bg-white/8" },
          { label: "Cooks", value: totalCooks, color: "bg-brand-500/10 dark:bg-brand-400/10" },
          { label: "Buyers", value: totalBuyers, color: "bg-punch-500/10 dark:bg-punch-400/10" },
          { label: "Bots", value: totalBots, color: "bg-violet-500/10 dark:bg-violet-400/10" },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border border-black/8 ${s.color} p-3 text-center dark:border-white/10`}
          >
            <div className="text-xl font-bold text-slate-900 dark:text-zinc-100">{s.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-black/8 bg-black/4 p-1 dark:border-white/8 dark:bg-white/4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={[
              "flex-shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition",
              activeTab === t.key
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-zinc-100"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/swipe">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-gradient-to-br from-brand-100 to-lime-100 px-3 py-4 text-center shadow-sm transition hover:shadow-md active:scale-95 dark:border-white/12 dark:from-brand-500/20 dark:to-lime-500/10">
                <span className="text-2xl">🍽️</span>
                <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Buyer view</div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400">Discover / Swipe</div>
              </div>
            </Link>
            <Link to="/requests">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-gradient-to-br from-punch-100 to-orange-100 px-3 py-4 text-center shadow-sm transition hover:shadow-md active:scale-95 dark:border-white/12 dark:from-punch-500/20 dark:to-orange-500/10">
                <span className="text-2xl">👨‍🍳</span>
                <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Cook view</div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400">Requests / Matches</div>
              </div>
            </Link>
            <Link to="/matches">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-gradient-to-br from-sky-100 to-blue-100 px-3 py-4 text-center shadow-sm transition hover:shadow-md active:scale-95 dark:border-white/12 dark:from-sky-500/20 dark:to-blue-500/10">
                <span className="text-2xl">💬</span>
                <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">All Chats</div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400">Matches & Messages</div>
              </div>
            </Link>
            <Link to="/map">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-gradient-to-br from-green-100 to-emerald-100 px-3 py-4 text-center shadow-sm transition hover:shadow-md active:scale-95 dark:border-white/12 dark:from-green-500/20 dark:to-emerald-500/10">
                <span className="text-2xl">🗺️</span>
                <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">Map view</div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400">Cook locations</div>
              </div>
            </Link>
          </div>

          <Card className="p-4">
            <div className="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">
              Seed Bot Profiles
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "both", label: "Cook + buyer" },
                  { v: "cook", label: "Cook only" },
                  { v: "buyer", label: "Buyer only" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSeedRole(opt.v)}
                  className={[
                    "rounded-2xl border px-3 py-3 text-xs font-semibold transition",
                    seedRole === opt.v
                      ? "border-brand-500/30 bg-brand-500/15 text-slate-900 dark:text-zinc-100"
                      : "border-black/10 bg-white/70 text-slate-700 hover:bg-white/90 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Count: {seedCount}
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={seedCount}
                onChange={(e) => setSeedCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <Button
              variant="primary"
              className="mt-3 w-full"
              onClick={() => seedBots()}
              disabled={isSeeding}
            >
              {isSeeding ? "Creating bots…" : "Create bot profiles"}
            </Button>
          </Card>

          <div className="flex gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              {totalVerified} KYC verified
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-punch-400" />
              {totalBots} bots
            </div>
          </div>
        </div>
      )}

      {(activeTab === "cooks" || activeTab === "buyers") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, id, role…"
              className="flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
            />
            <Button variant="secondary" onClick={() => refresh()} disabled={isLoading}>
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">Loading…</div>
          ) : tableRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">No results.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/8 dark:border-white/8">
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Name
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Status
                    </th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {tableRows.map((p) => (
                    <tr key={p.id} className="transition hover:bg-black/2 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                              className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-200 to-brand-400 text-xs font-bold text-white">
                              {(p.nickname ?? p.name).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900 dark:text-zinc-100">
                              {p.nickname ?? p.name}
                            </div>
                            <div className="truncate text-[10px] text-slate-400 dark:text-zinc-500">
                              {p.id.slice(0, 14)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              p.kyc_status === "verified"
                                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                            ].join(" ")}
                          >
                            {p.kyc_status === "verified" ? "✓ KYC" : "KYC?"}
                          </span>
                          {p.is_bot && (
                            <span className="rounded-full bg-punch-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-punch-600 dark:text-punch-400">
                              Bot
                            </span>
                          )}
                          {p.is_admin && (
                            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              update(p.id, { kyc_status: p.kyc_status === "verified" ? "unverified" : "verified" })
                            }
                            className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/8"
                          >
                            {p.kyc_status === "verified" ? "Unverify" : "Verify"}
                          </button>
                          <button
                            type="button"
                            onClick={() => update(p.id, { is_bot: !p.is_bot })}
                            className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/8"
                          >
                            {p.is_bot ? "Unbot" : "Bot"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p.id)}
                            className="rounded-lg border border-red-400/30 px-2 py-1 text-[11px] font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && tableRows.length > 0 && (
            <div className="text-right text-xs text-slate-400 dark:text-zinc-500">
              Showing {tableRows.length} {activeTab}
            </div>
          )}
        </div>
      )}

      {activeTab === "stories" && (
        <div className="space-y-2">
          {stories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-black/2 p-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
              No active stories right now.
            </div>
          ) : (
            stories.map((s) => {
              const name = s.cook?.nickname ?? s.cook?.name ?? "Unknown cook";
              return (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-xl border border-black/8 bg-white p-3 dark:border-white/[0.06] dark:bg-slate-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
                      by {name}
                      {(s.menu_items ?? []).length > 0
                        ? ` · ${(s.menu_items ?? []).join(", ")}`
                        : ""}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">
                      Expires{" "}
                      {new Date(s.expires_at).toLocaleString("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteStory(s.id).then(() => refreshStories())}
                    className="flex-shrink-0 rounded-lg border border-red-400/30 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/12 dark:bg-slate-900">
            <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Delete this account?
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              This will permanently remove the profile and all associated data. This cannot be undone.
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-2xl border border-black/10 py-3 text-sm font-semibold text-slate-700 transition hover:bg-black/4 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/6"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => deleteAccount(confirmDelete)}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white transition hover:bg-red-600 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
