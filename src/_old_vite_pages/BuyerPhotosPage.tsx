import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { XIcon } from "../components/ui/Icons";
import { useAuth } from "../hooks/useAuth";
import { uploadPublicMedia } from "../lib/media";

export function BuyerPhotosPage() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<string[]>(() => profile?.photos ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => photos.length >= 1 && !isSaving && !isUploading,
    [photos.length, isSaving, isUploading],
  );

  const addFiles = async (files: FileList | null) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add photos");
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    if (!profile) return;
    if (profile.role !== "buyer") {
      navigate("/onboarding/cook", { replace: true });
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        photos,
        avatar_url: photos[0] ?? profile.avatar_url,
        onboarding_completed: true,
      });
      navigate("/swipe", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save photos");
    } finally {
      setIsSaving(false);
    }
  };

  const skip = async () => {
    setError(null);
    setIsSaving(true);
    try {
      if (profile?.role !== "buyer") {
        navigate("/onboarding/cook", { replace: true });
        return;
      }
      await updateProfile({ onboarding_completed: true });
      navigate("/swipe", { replace: true });
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
            Add photos
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            Upload 1–5 photos. At least 1 is required.
          </div>
        </div>
        <Button variant="ghost" onClick={() => skip()} disabled={isSaving}>
          Skip
        </Button>
      </header>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
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
            <label className="flex aspect-[4/5] cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-white/80 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200 dark:hover:bg-white/10">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              {isUploading ? "Uploading…" : "Add"}
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <Button
            className="w-full"
            variant="primary"
            onClick={() => save()}
            disabled={!canSave}
          >
            {isSaving ? "Saving…" : "Continue"}
          </Button>
          <div className="mt-2 text-center text-xs text-slate-600 dark:text-zinc-400">
            Your first photo becomes your main profile picture.
          </div>
        </div>
      </Card>
    </div>
  );
}
