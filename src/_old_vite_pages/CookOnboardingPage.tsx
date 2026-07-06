import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { XIcon } from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { useStories } from "../hooks/useStories";
import { supabase } from "../lib/supabase";
import { uploadPublicMedia } from "../lib/media";
import type { Dish } from "../types/db";

type DishDraft = {
  name: string;
  image_url: string | null;
};

export function CookOnboardingPage() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { stories, postStory, deleteStory, refresh: refreshStories } = useStories(user?.id ?? null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [specialty, setSpecialty] = useState(profile?.specialty ?? "");
  const [age, setAge] = useState<string>(
    profile?.age != null ? String(profile.age) : "",
  );
  const [priceMin, setPriceMin] = useState<string>(
    profile?.price_min != null ? String(profile.price_min) : "",
  );
  const [priceMax, setPriceMax] = useState<string>(
    profile?.price_max != null ? String(profile.price_max) : "",
  );
  const [photos, setPhotos] = useState<string[]>(() => profile?.photos ?? []);
  const [dishes, setDishes] = useState<DishDraft[]>([
    { name: "", image_url: null },
    { name: "", image_url: null },
    { name: "", image_url: null },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storyTitle, setStoryTitle] = useState("");
  const [storyDesc, setStoryDesc] = useState("");
  const [storyMenuInput, setStoryMenuInput] = useState("");
  const [storyMenuItems, setStoryMenuItems] = useState<string[]>([]);
  const [isPostingStory, setIsPostingStory] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyPosted, setStoryPosted] = useState(false);
  const menuInputRef = useRef<HTMLInputElement>(null);

  const loadExisting = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    const { data, error: dishesError } = await supabase
      .from("dishes")
      .select("*")
      .eq("cook_id", user.id)
      .order("created_at", { ascending: true });
    if (dishesError) {
      setError(dishesError.message);
      setIsLoading(false);
      return;
    }
    const rows = (data as Dish[]) ?? [];
    setDishes([
      { name: rows[0]?.name ?? "", image_url: rows[0]?.image_url ?? null },
      { name: rows[1]?.name ?? "", image_url: rows[1]?.image_url ?? null },
      { name: rows[2]?.name ?? "", image_url: rows[2]?.image_url ?? null },
    ]);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadExisting().catch(() => {});
  }, [loadExisting]);

  const canSave = useMemo(() => {
    if (isSaving) return false;
    return (
      specialty.trim().length > 0 ||
      dishes.some((d) => d.name.trim().length > 0) ||
      Boolean(avatarUrl)
    );
  }, [avatarUrl, dishes, isSaving, specialty]);

  const onPickAvatar = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const url = await uploadPublicMedia({
        userId: user.id,
        folder: "profile",
        file,
        maxWidth: 1080,
        maxHeight: 1350,
        quality: 0.82,
      });
      setAvatarUrl(url);
      setPhotos((prev) => {
        if (prev.includes(url)) return prev;
        return [url, ...prev].slice(0, 5);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setIsUploading(false);
    }
  };

  const onPickDishImage = async (index: number, file: File | null) => {
    if (!file) return;
    setError(null);
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const url = await uploadPublicMedia({
        userId: user.id,
        folder: "dish",
        file,
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
      });
      setDishes((prev) =>
        prev.map((d, i) => (i === index ? { ...d, image_url: url } : d)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setIsUploading(false);
    }
  };

  const addProfilePhotos = async (files: FileList | null) => {
    if (!files) return;
    if (!user?.id) return;
    setError(null);
    setIsUploading(true);
    try {
      const picked = Array.from(files).slice(0, 5 - photos.length);
      const next = await Promise.all(
        picked.map((file) =>
          uploadPublicMedia({
            userId: user.id,
            folder: "profile",
            file,
            maxWidth: 1080,
            maxHeight: 1350,
            quality: 0.82,
          }),
        ),
      );
      setPhotos((prev) => [...prev, ...next].slice(0, 5));
      setAvatarUrl((prev) => prev ?? next[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add photos");
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    if (!user?.id || !profile) return;
    if (profile.role !== "cook") {
      navigate("/onboarding/photos", { replace: true });
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        avatar_url: avatarUrl,
        specialty: specialty.trim() ? specialty.trim() : null,
        age: age.trim() ? Number(age.trim()) : null,
        price_min: priceMin.trim() ? Number(priceMin.trim()) : null,
        price_max: priceMax.trim() ? Number(priceMax.trim()) : null,
        photos: photos.length > 0 ? photos : null,
        onboarding_completed: true,
      });

      const { error: deleteError } = await supabase
        .from("dishes")
        .delete()
        .eq("cook_id", user.id);
      if (deleteError) throw deleteError;

      const toInsert = dishes
        .map((d) => ({
          cook_id: user.id,
          name: d.name.trim(),
          image_url: d.image_url,
        }))
        .filter((d) => d.name.length > 0)
        .slice(0, 3);

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("dishes")
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      navigate("/requests", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const addMenuItem = () => {
    const val = storyMenuInput.trim().replace(/,+$/, "");
    if (!val) return;
    setStoryMenuItems((prev) =>
      prev.includes(val) ? prev : [...prev, val],
    );
    setStoryMenuInput("");
    menuInputRef.current?.focus();
  };

  const saveStory = async () => {
    if (!storyTitle.trim()) return;
    setStoryError(null);
    setIsPostingStory(true);
    try {
      await postStory({
        title: storyTitle.trim(),
        description: storyDesc.trim() || undefined,
        menu_items: storyMenuItems.length > 0 ? storyMenuItems : undefined,
      });
      setStoryTitle("");
      setStoryDesc("");
      setStoryMenuItems([]);
      setStoryMenuInput("");
      setStoryPosted(true);
      setTimeout(() => setStoryPosted(false), 4000);
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : "Failed to post story");
    } finally {
      setIsPostingStory(false);
    }
  };

  const skip = async () => {
    setError(null);
    setIsSaving(true);
    try {
      if (profile?.role !== "cook") {
        navigate("/onboarding/photos", { replace: true });
        return;
      }
      await updateProfile({ onboarding_completed: true });
      navigate("/requests", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Set up your cook page
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            Add a photo, dishes, and your specialty. You can skip for now.
          </div>
        </div>
        <Button variant="ghost" onClick={() => skip()} disabled={isSaving}>
          Skip
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Profile photo
          </div>
          <div className="flex items-start gap-3">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/8">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                />
                {isUploading ? "Uploading…" : "Upload photo"}
              </label>
              {avatarUrl ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white"
                  onClick={() => setAvatarUrl(null)}
                >
                  <XIcon className="h-4 w-4" />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            More photos (1–5)
          </div>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((src, idx) => (
              <div
                key={src}
                className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black/5 dark:bg-white/8"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/70"
                  aria-label="Remove"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}

            {photos.length < 5 ? (
              <label className="flex aspect-[4/5] cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/60 text-xs font-semibold text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addProfilePhotos(e.target.files)}
                />
                {isUploading ? "Uploading…" : "Add"}
              </label>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
            Your first photo becomes your main profile picture.
          </div>
        </div>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Specialty
          </div>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="e.g. Ramen, BBQ, Healthy bowls"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Age
            </div>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 27"
              inputMode="numeric"
              className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Price range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min"
                inputMode="numeric"
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
              />
              <input
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max"
                inputMode="numeric"
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
              />
            </div>
          </label>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Menu (up to 3)
          </div>
          <div className="space-y-3">
            {dishes.map((d, i) => (
              <div
                key={i}
                className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/12 dark:bg-white/6"
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/8">
                    {d.image_url ? (
                      <img
                        src={d.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      value={d.name}
                      onChange={(e) =>
                        setDishes((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder={`Dish ${i + 1} name`}
                      className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/8 dark:text-zinc-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white/90 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            onPickDishImage(i, e.target.files?.[0] ?? null)
                          }
                        />
                        Upload photo
                      </label>
                      {d.image_url ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white/90 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10"
                          onClick={() =>
                            setDishes((prev) =>
                              prev.map((x, idx) =>
                                idx === i ? { ...x, image_url: null } : x,
                              ),
                            )
                          }
                        >
                          <XIcon className="h-4 w-4" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <Button
          className="w-full"
          variant="primary"
          onClick={() => save()}
          disabled={!canSave || isLoading}
        >
          {isSaving ? "Saving…" : "Continue"}
        </Button>
        <div className="text-center text-xs text-slate-600 dark:text-zinc-400">
          Identity verification is optional now, but required before you can
          accept matches.
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-4">
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            Tonight's Story
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Tell buyers what you're cooking today. Story expires in 24 hours.
          </div>
        </div>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Story title *
          </div>
          <input
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            placeholder="e.g. Egusi Night 🍲 — spots available"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Description (optional)
          </div>
          <textarea
            value={storyDesc}
            onChange={(e) => setStoryDesc(e.target.value)}
            placeholder="A little more about tonight's session..."
            rows={2}
            className="w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Menu items (optional)
          </div>
          <div className="flex gap-2">
            <input
              ref={menuInputRef}
              value={storyMenuInput}
              onChange={(e) => setStoryMenuInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addMenuItem();
                }
              }}
              placeholder="e.g. Egusi Soup, Eba, Assorted meat"
              className="flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={addMenuItem}
              className="rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white/90 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200"
            >
              Add
            </button>
          </div>
          {storyMenuItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {storyMenuItems.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-300"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      setStoryMenuItems((prev) =>
                        prev.filter((x) => x !== item),
                      )
                    }
                    className="opacity-60 hover:opacity-100"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {storyError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 dark:text-red-300">
            {storyError}
          </div>
        ) : null}

        {storyPosted ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-semibold text-green-700 dark:text-green-400">
            ✓ Story posted! It will appear to buyers for the next 24 hours.
          </div>
        ) : null}

        <Button
          variant="primary"
          className="w-full"
          onClick={saveStory}
          disabled={!storyTitle.trim() || isPostingStory}
        >
          {isPostingStory ? "Posting…" : "Post Story (24h)"}
        </Button>

        {stories.length > 0 ? (
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Your active stories
            </div>
            <div className="space-y-2">
              {stories
                .filter((s) => s.cook_id === user?.id)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {s.title}
                      </div>
                      {(s.menu_items ?? []).length > 0 ? (
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
                          {(s.menu_items ?? []).join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        deleteStory(s.id).then(() => refreshStories())
                      }
                      className="flex-shrink-0 text-xs font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
