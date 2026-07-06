import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";

export function ProfileSetupPage() {
  const { user, profile, upsertProfile } = useAuth();
  const navigate = useNavigate();

  const role = profile?.role ?? "buyer";
  const ageAlreadySet = Boolean(profile?.age && profile.onboarding_completed);

  const [name, setName] = useState(profile?.name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [age, setAge] = useState<string>(profile?.age ? String(profile.age) : "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [lookingFor, setLookingFor] = useState(profile?.looking_for ?? "");

  const [cuisines, setCuisines] = useState<string[]>((profile?.cuisines ?? []).filter(Boolean));
  const [interests, setInterests] = useState<string[]>((profile?.interests ?? []).filter(Boolean));
  const [favoriteFoods, setFavoriteFoods] = useState<string[]>((profile?.favorite_foods ?? []).filter(Boolean));

  const [specialty, setSpecialty] = useState(profile?.specialty ?? "");
  const [priceMin, setPriceMin] = useState<string>(profile?.price_min != null ? String(profile.price_min) : "");
  const [priceMax, setPriceMax] = useState<string>(profile?.price_max != null ? String(profile.price_max) : "");

  const [customFood, setCustomFood] = useState("");
  const customFoodRef = useRef<HTMLInputElement>(null);

  const [lat, setLat] = useState<number | null>(profile?.lat ?? null);
  const [lng, setLng] = useState<number | null>(profile?.lng ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CUISINE_OPTIONS_COOK = [
    "Nigerian", "Yoruba", "Igbo", "Hausa", "Ghanaian",
    "West African", "Afro-fusion", "Italian", "Asian",
    "Mediterranean", "Vegan", "International",
  ];

  const CUISINE_OPTIONS_BUYER = [
    "Nigerian", "Yoruba", "Igbo", "Hausa", "Ghanaian",
    "West African", "Afro-fusion", "Italian", "Asian",
    "Mediterranean", "Vegan", "International",
  ];

  const INTEREST_OPTIONS = [
    "Home cooking", "Street food", "Jollof parties", "Suya nights",
    "Fine dining", "Brunch", "Late night", "Comfort food",
    "Healthy eating", "BBQ", "Small chops", "Spicy",
  ];

  const PRESET_FOODS = [
    "Jollof Rice", "Egusi Soup", "Pounded Yam", "Pepper Soup",
    "Suya", "Fried Plantain", "Efo Riro", "Moi Moi",
    "Ofada Rice", "Amala", "Shawarma", "Akara",
  ];

  const addCustomFood = () => {
    const val = customFood.trim();
    if (!val) return;
    if (!favoriteFoods.includes(val)) {
      setFavoriteFoods((prev) => [...prev, val]);
    }
    setCustomFood("");
    customFoodRef.current?.focus();
  };

  const canSave = useMemo(() => {
    if (!user?.id || isSaving) return false;
    if (name.trim().length < 2) return false;
    if (role === "cook") return cuisines.length > 0;
    return cuisines.length > 0 || favoriteFoods.length > 0 || interests.length > 0;
  }, [user?.id, name, cuisines.length, favoriteFoods.length, interests.length, isSaving, role]);

  const detectLocation = async () => {
    setError(null);
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); resolve(); },
        () => { setError("Could not get location. You can skip this for now."); resolve(); },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  };

  const save = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const parsedAge = age.trim() ? parseInt(age.trim(), 10) : null;
      const parsedMin = priceMin.trim() ? parseInt(priceMin.trim(), 10) : null;
      const parsedMax = priceMax.trim() ? parseInt(priceMax.trim(), 10) : null;

      const next = await upsertProfile({
        role,
        name: name.trim(),
        avatar_url: profile?.avatar_url ?? null,
        phone: phone.trim() || null,
        nickname: nickname.trim() || null,
        looking_for: lookingFor.trim() || null,
        bio: bio.trim() || null,
        cuisines: cuisines.length > 0 ? cuisines : null,
        interests: interests.length > 0 ? interests : null,
        favorite_foods: favoriteFoods.length > 0 ? favoriteFoods : null,
        age: ageAlreadySet ? profile!.age : (parsedAge && parsedAge >= 18 && parsedAge <= 80 ? parsedAge : null),
        specialty: role === "cook" ? (specialty.trim() || null) : null,
        price_min: role === "cook" ? parsedMin : null,
        price_max: role === "cook" ? parsedMax : null,
        lat,
        lng,
      });

      if (profile?.onboarding_completed) {
        navigate("/profile", { replace: true });
        return;
      }

      navigate(next.role === "buyer" ? "/onboarding/photos" : "/onboarding/cook", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const isBuyer = role === "buyer";

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-8">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Food4Love
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
          {isBuyer ? "Your profile" : "Cook profile"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
          {isBuyer
            ? "Tell cooks a bit about yourself."
            : "Let buyers know who you are and what you cook."}
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/8">
          <span className="text-base">{isBuyer ? "🍽️" : "👩‍🍳"}</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            {isBuyer ? "Buyer" : "Cook"}
          </span>
        </div>
      </div>

      <Card className="space-y-5 p-4">

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Full name <span className="text-red-400">*</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Nickname <span className="text-slate-400 font-normal">(optional)</span>
          </div>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What should we call you?"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Age <span className="text-red-400">*</span>
            {ageAlreadySet ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                locked
              </span>
            ) : (
              <span className="font-normal text-slate-400">(cannot be changed after signup)</span>
            )}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={18}
            max={80}
            value={age}
            onChange={(e) => { if (!ageAlreadySet) setAge(e.target.value); }}
            readOnly={ageAlreadySet}
            placeholder="Your age (18–80)"
            className={[
              "w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none",
              ageAlreadySet
                ? "bg-black/5 text-slate-500 cursor-not-allowed dark:bg-white/5 dark:text-zinc-400"
                : "bg-white/70 text-slate-900 ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100",
            ].join(" ")}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Phone <span className="text-slate-400 font-normal">(optional)</span>
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234 XXX XXX XXXX"
            inputMode="tel"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {isBuyer ? "About you" : "About you & your cooking"}
            <span className="ml-1 font-normal text-slate-400">(optional)</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={isBuyer ? "What are you craving lately?" : "Tell buyers about your cooking style…"}
            rows={3}
            className="w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        {isBuyer ? (
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              What are you here for? <span className="font-normal text-slate-400">(optional)</span>
            </div>
            <input
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              placeholder="e.g. Dates, food buddies, home-cooked meals"
              className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
            />
          </label>
        ) : null}

        {!isBuyer ? (
          <>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Your specialty <span className="text-slate-400 font-normal">(optional)</span>
              </div>
              <input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Egusi & Pounded Yam, Jollof Rice"
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
              />
            </label>

            <div>
              <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Price range (₦) <span className="font-normal text-slate-400">(optional)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Min (e.g. 3000)"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
                />
                <input
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Max (e.g. 8000)"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
                />
              </div>
            </div>
          </>
        ) : null}

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            {isBuyer ? "Cuisines you enjoy" : "Cuisines you cook"}
            {!isBuyer ? <span className="ml-1 text-red-400">*</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {(isBuyer ? CUISINE_OPTIONS_BUYER : CUISINE_OPTIONS_COOK).map((opt) => {
              const active = cuisines.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCuisines((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                  className={[
                    "rounded-full border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? "border-brand-500/30 bg-brand-400/20 text-slate-900 dark:text-zinc-100"
                      : "border-black/10 bg-white/50 text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-300",
                  ].join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {isBuyer ? (
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Food interests
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => {
                const active = interests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterests((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                    className={[
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      active
                        ? "border-punch-500/30 bg-punch-500/15 text-slate-900 dark:text-zinc-100"
                        : "border-black/10 bg-white/50 text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-300",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isBuyer ? (
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Favorite foods <span className="font-normal text-slate-400">(tap or type your own)</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_FOODS.map((opt) => {
                const active = favoriteFoods.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFavoriteFoods((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                    className={[
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      active
                        ? "border-brand-500/30 bg-brand-400/20 text-slate-900 dark:text-zinc-100"
                        : "border-black/10 bg-white/50 text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-300",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                ref={customFoodRef}
                type="text"
                value={customFood}
                onChange={(e) => setCustomFood(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFood(); } }}
                placeholder="Type a food & press Enter…"
                className="flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={addCustomFood}
                className="rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white/90 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200"
              >
                Add
              </button>
            </div>
            {favoriteFoods.filter((f) => !PRESET_FOODS.includes(f)).length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {favoriteFoods.filter((f) => !PRESET_FOODS.includes(f)).map((f) => (
                  <span
                    key={f}
                    className="flex items-center gap-1 rounded-full bg-punch-500/10 px-3 py-1 text-xs font-semibold text-punch-700 dark:bg-punch-400/15 dark:text-punch-300"
                  >
                    {f}
                    <button
                      type="button"
                      onClick={() => setFavoriteFoods((prev) => prev.filter((x) => x !== f))}
                      className="opacity-60 hover:opacity-100 text-base leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/12 dark:bg-white/6">
          <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
            📍 Location
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            {lat != null && lng != null
              ? "✓ Location saved — we'll show you people near you."
              : "Enable location to see and be seen by people near you."}
          </div>
          {lat == null ? (
            <button
              type="button"
              onClick={detectLocation}
              className="mt-2 rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-black/10 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12"
            >
              Enable location
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={save}
          disabled={!canSave}
          variant="primary"
          className="w-full py-4 text-base"
        >
          {isSaving ? "Saving…" : "Continue →"}
        </Button>

        <p className="text-center text-xs text-slate-400 dark:text-zinc-600">
          {isBuyer ? "Next: add your photos" : "Next: add photos & your menu"}
        </p>
      </Card>
    </div>
  );
}
