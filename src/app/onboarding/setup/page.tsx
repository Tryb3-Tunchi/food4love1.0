"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, ProfileInput } from "@/lib/validations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { updateProfile } from "@/services/profiles";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { MapPin, FileText, Sparkles } from "lucide-react";
import { useState } from "react";

const CUISINES = ["Jollof & Rice","Igbo Cuisine","Yoruba Cuisine","Hausa Cuisine","Nigerian BBQ","Seafood","Swallow & Soup","Pastries & Baking","Continental","Asian Fusion"];

export default function SetupPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const updateStore = useAuthStore((s) => s.updateProfile);
  const [selected, setSelected] = useState<string[]>([]);
  const [generatingBio, setGeneratingBio] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) });

  const toggleCuisine = (c: string) => {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
    setSelected(next);
    setValue("cuisines", next);
  };

  const generateBio = async () => {
    if (!profile) return;
    setGeneratingBio(true);
    try {
      const res = await fetch("/api/ai/bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.full_name, cuisines: selected.join(", "), location: watch("location"), specialty: selected[0] }),
      });
      const { bio } = await res.json();
      if (bio) setValue("bio", bio);
    } finally { setGeneratingBio(false); }
  };

  const onSubmit = async (data: ProfileInput) => {
    if (!profile) return;
    try {
      const updated = await updateProfile(profile.id, { ...data, cuisines: selected, onboarding_complete: true });
      updateStore(updated);
      toast.success("Profile saved!");
      router.push("/swipe");
    } catch { toast.error("Failed to save profile"); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-char px-5 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm mx-auto w-full">
        <div className="mb-8">
          <div className="flex gap-1 mb-6">{[1,2,3].map((s) => <div key={s} className={`h-1 flex-1 rounded-full ${s <= 2 ? "bg-pepper" : "bg-coal"}`} />)}</div>
          <h1 className="text-2xl font-bold text-white mb-1">Set up your profile</h1>
          <p className="text-sm text-mist">Step 2 of 3 — Almost there!</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input label="Your location" placeholder="Lekki, Lagos" leftIcon={<MapPin className="h-4 w-4" />} error={errors.location?.message} {...register("location")} />

          <div>
            <label className="text-sm font-medium text-white mb-2 block">Your cuisines</label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCuisine(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${selected.includes(c) ? "bg-pepper text-white shadow-glow" : "bg-coal text-mist hover:bg-smoke"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">Bio</label>
              <button type="button" onClick={generateBio} disabled={generatingBio || selected.length === 0}
                className="flex items-center gap-1 text-xs text-ember hover:text-ember/80 disabled:opacity-40 transition-all">
                <Sparkles className="h-3.5 w-3.5" />
                {generatingBio ? "Generating..." : "AI Write for me"}
              </button>
            </div>
            <textarea {...register("bio")} rows={3} placeholder="Tell food lovers about your cooking..."
              className="w-full rounded-lg border border-white/10 bg-coal px-3 py-2.5 text-sm text-cream placeholder:text-mist outline-none focus:border-pepper resize-none" />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Continue →</Button>
        </form>
      </motion.div>
    </div>
  );
}
