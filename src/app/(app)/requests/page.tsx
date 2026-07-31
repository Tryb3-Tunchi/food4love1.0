"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { UserCheck, UserX, Clock, ChefHat } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";

export default function RequestsPage() {
  const { profile } = useAuthStore();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["match-requests"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("swipes")
        .select(`
          *,
          swiper:profiles!swipes_swiper_id_fkey(id, full_name, avatar_url, bio)
        `)
        .eq("swiped_id", profile!.id)
        .eq("action", "like")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const handleAccept = async (swiperId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("matches").insert({
      user1_id: swiperId,
      user2_id: profile!.id,
      status: "matched",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) toast.error("Failed to accept");
    else {
      toast.success("Match accepted! Start chatting.");
      refetch();
    }
  };

  const handleDecline = async (swiperId: string) => {
    // Soft decline - just mark swipe as pass
    toast.info("Request declined");
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        icon={<ChefHat className="w-12 h-12" />}
        title="No requests yet"
        description="When food lovers like your profile, they'll appear here."
        action={{ label: "View Your Profile", href: "/profile" }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-4">
        <h1 className="text-2xl font-bold">Match Requests</h1>
        <p className="text-sm text-[var(--text-muted)]">{requests.length} pending {requests.length === 1 ? "request" : "requests"}</p>
      </div>

      <div className="p-4 space-y-3">
        {requests.map((req, idx) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[var(--border)] flex-shrink-0">
                {req.swiper?.avatar_url ? (
                  <Image src={req.swiper.avatar_url} alt="" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-2)] flex items-center justify-center text-2xl">👤</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{req.swiper?.full_name || "Food Lover"}</h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-1">{req.swiper?.bio || "No bio yet"}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]">
                  <Clock className="w-3 h-3" />
                  Liked you recently
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDecline(req.swiper_id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--bg-2)] hover:bg-red-500/10 hover:text-red-500 text-[var(--text-muted)] transition-colors text-sm font-medium"
              >
                <UserX className="w-4 h-4" />
                Decline
              </button>
              <button
                onClick={() => handleAccept(req.swiper_id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white transition-colors text-sm font-medium"
              >
                <UserCheck className="w-4 h-4" />
                Accept Match
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}