import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/db";

const formatNaira = (n: number) => {
  if (n >= 1000) return `₦${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `₦${n}`;
};

function onlineLabel(lastSeen: string | null | undefined) {
  if (!lastSeen) return null;
  const ms = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 5) return { text: "Online now", dotCls: "bg-green-500" };
  if (mins < 60) return { text: `Active ${mins}m ago`, dotCls: "bg-amber-400" };
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return { text: `Active ${hours}h ago`, dotCls: "bg-slate-400" };
  return null;
}

export function CookPublicPage() {
  const { id } = useParams<{ id: string }>();
  const [cook, setCook] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (!id) { setNotFound(true); setIsLoading(false); return; }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("role", "cook")
      .single()
      .then(
        ({ data, error }) => {
          if (error || !data) { setNotFound(true); }
          else { setCook(data as Profile); }
          setIsLoading(false);
        },
        () => { setNotFound(true); setIsLoading(false); },
      );
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !cook) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">🍽️</div>
        <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">Cook not found</div>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">This link may have expired or the cook profile no longer exists.</p>
        <Link to="/login" className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-bold text-white shadow-lg">
          Open Food4Love
        </Link>
      </div>
    );
  }

  const photos = [cook.avatar_url, ...(cook.photos ?? [])].filter(Boolean) as string[];
  const displayName = cook.nickname ?? cook.name;
  const shareUrl = window.location.href;
  const whatsappText = `Check out ${displayName}'s cooking on Food4Love! 🍽️\n${shareUrl}`;
  const status = onlineLabel(cook.last_seen_at);

  const tagCls = "rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-zinc-200";

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-white dark:bg-slate-950">
      <div className="relative h-[62vw] max-h-96 min-h-60 flex-shrink-0 overflow-hidden bg-black">
        {photos[photoIdx] ? (
          <img src={photos[photoIdx]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🧑‍🍳</div>
        )}

        {photos.length > 1 && (
          <div className="absolute left-0 right-0 top-3 flex gap-1 px-4">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={["h-0.5 flex-1 rounded-full transition-all", i === photoIdx ? "bg-white" : "bg-white/30"].join(" ")}
              />
            ))}
          </div>
        )}

        {photos.length > 1 && (
          <>
            <button type="button" className="absolute left-0 top-0 h-full w-1/3" onClick={() => setPhotoIdx((i) => (i === 0 ? photos.length - 1 : i - 1))} />
            <button type="button" className="absolute right-0 top-0 h-full w-1/3" onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)} />
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-10">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold text-white">
                {displayName}
                {cook.age != null && <span className="ml-2 text-xl font-semibold opacity-80">{cook.age}</span>}
              </div>
              {cook.specialty && (
                <div className="mt-0.5 text-sm text-white/75">{cook.specialty}</div>
              )}
            </div>
            {status && (
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
                <span className={["h-2 w-2 rounded-full", status.dotCls].join(" ")} />
                <span className="text-xs font-semibold text-white">{status.text}</span>
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-4 top-4">
          <div className="rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Food4Love
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {cook.price_min != null && cook.price_max != null && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-500/10 px-4 py-3 dark:bg-brand-400/10">
            <div className="text-2xl">🍽️</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">Session Rate</div>
              <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {formatNaira(cook.price_min)} – {formatNaira(cook.price_max)}
              </div>
            </div>
            {cook.available_for_parties && (
              <div className="ml-auto rounded-full bg-punch-500/15 px-2.5 py-1 text-xs font-bold text-punch-700 dark:text-punch-400">
                🎉 Parties
              </div>
            )}
          </div>
        )}

        {cook.bio && (
          <div className="mb-5">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">About</div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{cook.bio}</p>
          </div>
        )}

        {(cook.cuisines ?? []).length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Cuisines</div>
            <div className="flex flex-wrap gap-2">
              {(cook.cuisines ?? []).map((c) => <span key={c} className={tagCls}>🍲 {c}</span>)}
            </div>
          </div>
        )}

        {(cook.interests ?? []).length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Vibes</div>
            <div className="flex flex-wrap gap-2">
              {(cook.interests ?? []).map((t) => <span key={t} className={tagCls}>✦ {t}</span>)}
            </div>
          </div>
        )}

        {(cook.favorite_foods ?? []).length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Signature Dishes</div>
            <div className="flex flex-wrap gap-2">
              {(cook.favorite_foods ?? []).map((f) => <span key={f} className={tagCls}>🔥 {f}</span>)}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <Link
            to={`/login?next=/swipe`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-4 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition active:scale-95"
          >
            <span>🍽️</span>
            <span>Match with {displayName} on Food4Love</span>
          </Link>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 py-3.5 text-sm font-bold text-[#1a9e4a] transition active:scale-95 dark:border-[#25D366]/30 dark:bg-[#25D366]/10 dark:text-[#25D366]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.549 4.103 1.51 5.833L.054 23.394a.75.75 0 00.917.916l5.562-1.456A11.945 11.945 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.75a9.708 9.708 0 01-4.95-1.353l-.354-.211-3.668.96.977-3.565-.229-.368A9.706 9.706 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
            </svg>
            Share on WhatsApp
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-zinc-600">
          Food4Love — Match with cooks. Eat well. 🍲
        </p>
      </div>
    </div>
  );
}
