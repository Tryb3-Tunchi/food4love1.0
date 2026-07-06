import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export function KycPage() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState(profile?.kyc_full_name ?? "");
  const [country, setCountry] = useState(profile?.kyc_country ?? "");
  const [selfie, setSelfie] = useState<string | null>(
    profile?.kyc_selfie ?? null,
  );
  const [idDoc, setIdDoc] = useState<string | null>(
    profile?.kyc_id_doc ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    return (
      fullName.trim().length >= 2 &&
      country.trim().length >= 2 &&
      Boolean(selfie || idDoc)
    );
  }, [country, fullName, idDoc, isSubmitting, selfie]);

  const goBackTo = () => {
    const state = location.state as { from?: string } | null;
    navigate(state?.from ?? "/profile", { replace: true });
  };

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProfile({
        kyc_full_name: fullName.trim(),
        kyc_country: country.trim(),
        kyc_selfie: selfie,
        kyc_id_doc: idDoc,
        kyc_status: "verified",
      });
      goBackTo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skip = () => {
    goBackTo();
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Verify your identity
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            For now this is a simple demo check. Later we’ll connect real KYC.
          </div>
        </div>
        <Button variant="ghost" onClick={() => skip()} disabled={isSubmitting}>
          Not now
        </Button>
      </header>

      <Card className="space-y-3 p-4">
        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Legal name
          </div>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Country
          </div>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Canada"
            className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
        </label>

        <div className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/12 dark:bg-white/6">
          <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
            Selfie (required)
          </div>
          <div className="mt-2 flex items-start gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/8">
              {selfie ? (
                <img
                  src={selfie}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-black/20 hover:bg-white/90 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/12">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    setError(null);
                    try {
                      setSelfie(await readFileAsDataUrl(file));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                />
                Upload selfie
              </label>
              {selfie ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setSelfie(null)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/12 dark:bg-white/6">
          <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
            ID card (optional)
          </div>
          <div className="mt-2 flex items-start gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/8">
              {idDoc ? (
                <img
                  src={idDoc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-black/20 hover:bg-white/90 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/12">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    setError(null);
                    try {
                      setIdDoc(await readFileAsDataUrl(file));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                />
                Upload ID
              </label>
              {idDoc ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIdDoc(null)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
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
          onClick={() => submit()}
          disabled={!canSubmit}
        >
          {isSubmitting ? "Verifying…" : "Verify now"}
        </Button>
      </Card>
    </div>
  );
}
