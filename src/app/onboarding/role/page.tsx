"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { updateProfile } from "@/services/profiles";

export default function RoleSelectPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const updateStore = useAuthStore((s) => s.updateProfile);

  const selectRole = async (role: "cook" | "buyer") => {
    if (!profile) return;
    await updateProfile(profile.id, { role });
    updateStore({ role });
    router.push("/onboarding/setup");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-char px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
        <div className="flex gap-1 mb-8 max-w-xs mx-auto">{[1,2,3].map((s) => <div key={s} className={`h-1 flex-1 rounded-full ${s <= 1 ? "bg-pepper" : "bg-coal"}`} />)}</div>
        <h1 className="font-display text-4xl text-white mb-3">I am a...</h1>
        <p className="text-mist mb-10">Step 1 of 3 — This personalises your experience</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { role: "buyer" as const, emoji: "🍽️", title: "Food Lover", desc: "Find amazing home chefs near you" },
            { role: "cook" as const, emoji: "🍳", title: "Home Chef", desc: "Cook, earn and grow your fanbase" },
          ].map(({ role, emoji, title, desc }) => (
            <motion.button key={role} onClick={() => selectRole(role)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-smoke p-6 hover:border-pepper/40 hover:bg-pepper/5 transition-all">
              <span className="text-5xl">{emoji}</span>
              <span className="font-bold text-white">{title}</span>
              <span className="text-xs text-mist">{desc}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
