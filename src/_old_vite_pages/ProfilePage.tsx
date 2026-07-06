import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { MoonIcon, SunIcon, UserIcon, XIcon } from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { uploadPublicMedia } from "../lib/media";

const formatNaira = (n: number) => {
  if (n >= 1000) return `₦${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `₦${n}`;
};

export function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [savingParties, setSavingParties] = useState(false);
  const [copied, setCopied] = useState(false);
  const [specialText, setSpecialText] = useState("");
  const [isSavingSpecial, setIsSavingSpecial] = useState(false);

  const [photos, setPhotos] = useState<string[]>(() => profile?.photos ?? []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const isCook = profile?.role === "cook";

  const addPhotos = async (files: FileList | null) => {
    if (!files || !user?.id) return;
    setPhotoError(null);
    setIsUploadingPhoto(true);
    try {
      const picked = Array.from(files).slice(0, 5 - photos.length);
      const next = await Promise.all(
        picked.map((file) =>
          uploadPublicMedia({ userId: user.id, folder: "profile", file, maxWidth: 1080, maxHeight: 1350, quality: 0.82 })
        )
      );
      const updated = [...photos, ...next].slice(0, 5);
      setPhotos(updated);
      await updateProfile({ photos: updated, avatar_url: updated[0] ?? profile?.avatar_url });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = async (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    await updateProfile({ photos: updated, avatar_url: updated[0] ?? null });
  };

  const isSpecialActive = Boolean(
    profile?.daily_special &&
    profile?.daily_special_until &&
    new Date(profile.daily_special_until) > new Date()
  );

  useEffect(() => {
    setSpecialText(isSpecialActive ? (profile?.daily_special ?? "") : "");
  }, [profile?.daily_special, profile?.daily_special_until]);

  const saveSpecial = async () => {
    if (!profile || isSavingSpecial) return;
    setIsSavingSpecial(true);
    try {
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      await updateProfile({
        daily_special: specialText.trim() || null,
        daily_special_until: specialText.trim() ? midnight.toISOString() : null,
      });
    } catch {}
    finally { setIsSavingSpecial(false); }
  };

  const clearSpecial = () => {
    setSpecialText("");
    void updateProfile({ daily_special: null, daily_special_until: null });
  };

  const referralCode = profile?.referral_code ?? profile?.id?.slice(0, 8).toUpperCase() ?? null;
  const referralLink = referralCode ? `${window.location.origin}/login?ref=${referralCode}` : null;

  const copyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const whatsappShareText = referralLink
    ? `Join me on Food4Love — the app to match with cooks who come cook at your place! 🍽️\nUse my link: ${referralLink}`
    : null;

  const toggleParties = async () => {
    if (!profile || savingParties) return;
    setSavingParties(true);
    try {
      await updateProfile({ available_for_parties: !profile.available_for_parties });
    } catch {}
    finally {
      setSavingParties(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Profile
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {user?.email ?? user?.id ?? "—"}
          </div>
        </div>
        <Button variant="ghost" onClick={() => toggleTheme()}>
          {theme === "dark" ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </Button>
      </header>

      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900">
          {profile?.avatar_url ? (
            <div className="h-32 w-full bg-black">
              <img
                src={profile.avatar_url}
                alt=""
                className="h-full w-full object-cover opacity-90"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-4 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-punch-500 text-xl font-bold text-white shadow-md">
              {profile?.name?.charAt(0)?.toUpperCase() ?? <UserIcon className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {profile?.nickname ?? profile?.name ?? "Unnamed"}
                {profile?.age ? (
                  <span className="ml-1.5 text-sm font-normal text-slate-500 dark:text-zinc-400">
                    {profile.age}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/8 dark:text-zinc-300">
                  {isCook ? "Cook" : "Foodie"}
                </span>
                {profile?.kyc_status === "verified" ? (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Unverified
                  </span>
                )}
              </div>
            </div>
          </div>

          {isCook &&
          (profile?.specialty || profile?.price_min != null) ? (
            <div className="mx-4 mb-3 rounded-xl bg-brand-500/8 px-3 py-2.5 dark:bg-brand-400/10">
              <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {profile.specialty ?? "Cook"}
                {profile.price_min != null && profile.price_max != null
                  ? ` · ${formatNaira(profile.price_min)}–${formatNaira(profile.price_max)}`
                  : ""}
              </div>
            </div>
          ) : null}

          {profile?.bio ? (
            <div className="mx-4 mb-3">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {profile.bio}
              </p>
            </div>
          ) : null}

          {(profile?.cuisines ?? []).length > 0 ? (
            <div className="mx-4 mb-4 flex flex-wrap gap-1.5">
              {(profile?.cuisines ?? []).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
                >
                  {c}
                </span>
              ))}
              {(profile?.interests ?? []).slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-punch-500/8 px-2.5 py-1 text-xs font-semibold text-punch-700 dark:text-punch-300"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900">
          <div className="px-4 pt-3.5 pb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              My Photos
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">
              First photo is your profile picture. Up to 5 total.
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((src, idx) => (
                <div
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-xl bg-black/5 dark:bg-white/8"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80"
                    aria-label="Remove photo"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                  {idx === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                      MAIN
                    </span>
                  ) : null}
                </div>
              ))}
              {photos.length < 5 ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/15 bg-white/60 text-center text-xs font-semibold text-slate-600 hover:bg-white/80 dark:border-white/12 dark:bg-white/5 dark:text-zinc-400">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addPhotos(e.target.files)}
                    disabled={isUploadingPhoto}
                  />
                  <span className="text-lg leading-none">{isUploadingPhoto ? "⏳" : "+"}</span>
                  <span className="text-[10px]">{isUploadingPhoto ? "Uploading…" : "Add"}</span>
                </label>
              ) : null}
            </div>
            {photoError ? (
              <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {photoError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900">
          <div className="divide-y divide-black/6 dark:divide-white/6">
            <Link to="/setup" className="block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-black/3 active:bg-black/5 dark:text-zinc-100 dark:hover:bg-white/5"
              >
                <span>✏️ Edit profile</span>
                <span className="text-slate-400">›</span>
              </button>
            </Link>

            {isCook ? (
              <Link to="/onboarding/cook" className="block">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-black/3 active:bg-black/5 dark:text-zinc-100 dark:hover:bg-white/5"
                >
                  <span>🧑‍🍳 Cook profile & stories</span>
                  <span className="text-slate-400">›</span>
                </button>
              </Link>
            ) : null}

            <Link
              to="/kyc"
              state={{ from: "/profile" }}
              className="block"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-black/3 active:bg-black/5 dark:text-zinc-100 dark:hover:bg-white/5"
              >
                <span>
                  {profile?.kyc_status === "verified"
                    ? "✅ Identity verified"
                    : "🪪 Verify identity"}
                </span>
                <span className="text-slate-400">›</span>
              </button>
            </Link>

            {isCook ? (
              <button
                type="button"
                onClick={toggleParties}
                disabled={savingParties}
                className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-black/3 active:bg-black/5 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-white/5"
              >
                <span>🎉 Available for parties</span>
                <span
                  className={[
                    "flex h-6 w-11 items-center rounded-full transition-colors",
                    profile?.available_for_parties
                      ? "bg-brand-500"
                      : "bg-slate-200 dark:bg-zinc-700",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-5 w-5 rounded-full bg-white shadow transition-transform",
                      profile?.available_for_parties ? "translate-x-5" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </span>
              </button>
            ) : null}

            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => signOut()}
            >
              <span>Sign out</span>
              <span className="text-red-400">›</span>
            </button>
          </div>
        </div>

        {isCook ? (
          <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900">
            <div className="px-4 py-3.5">
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Today&apos;s Special
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                Post what you&apos;re making today — buyers see it live on your card
              </div>
            </div>
            <div className="border-t border-black/6 px-4 py-3 dark:border-white/[0.05]">
              <input
                type="text"
                maxLength={80}
                value={specialText}
                onChange={(e) => setSpecialText(e.target.value)}
                placeholder="e.g. Egusi + Pounded Yam · ₦5,500 🍲"
                className="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/8 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveSpecial}
                  disabled={isSavingSpecial || !specialText.trim()}
                  className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-500 active:scale-95 disabled:opacity-40"
                >
                  {isSavingSpecial ? "Posting…" : "Post for today"}
                </button>
                {isSpecialActive ? (
                  <button
                    type="button"
                    onClick={clearSpecial}
                    className="rounded-xl border border-black/10 px-3 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-black/5 active:scale-95 dark:border-white/10 dark:text-zinc-400"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {isSpecialActive ? (
                <div className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  ✓ Live until midnight — buyers can see this on your card
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {referralCode ? (
          <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/[0.06] dark:bg-slate-900">
            <div className="px-4 py-3.5">
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Referral Code
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                Invite a friend — they get ₦500 off their first booking
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-black/6 px-4 py-3 dark:border-white/[0.05]">
              <div className="flex-1 rounded-xl bg-black/5 px-3 py-2 text-sm font-mono font-bold tracking-widest text-slate-900 dark:bg-white/8 dark:text-zinc-100">
                {referralCode}
              </div>
              <button
                type="button"
                onClick={copyReferralLink}
                className="rounded-xl bg-brand-500/10 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-500/20 active:scale-95 dark:text-brand-300"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            {whatsappShareText ? (
              <div className="border-t border-black/6 px-4 py-3 dark:border-white/[0.05]">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 py-2.5 text-sm font-bold text-[#1a9e4a] transition active:scale-95 dark:border-[#25D366]/30 dark:text-[#25D366]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.549 4.103 1.51 5.833L.054 23.394a.75.75 0 00.917.916l5.562-1.456A11.945 11.945 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.75a9.708 9.708 0 01-4.95-1.353l-.354-.211-3.668.96.977-3.565-.229-.368A9.706 9.706 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
                  </svg>
                  Share invite on WhatsApp
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
