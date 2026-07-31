"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heart, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LikesPage() {
  const { profile } = useAuthStore();

  const { data: likes, isLoading } = useQuery({
    queryKey: ["my-likes"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("swipes")
        .select(`
          *,
          swiped:profiles!swipes_swiped_id_fkey(id, full_name, avatar_url, bio, cuisines, price_min, price_max)
        `)
        .eq("swiper_id", profile!.id)
        .eq("action", "like")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!likes || likes.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="w-12 h-12" />}
        title="No likes yet"
        description="Chefs you like will appear here. Start discovering!"
        action={{ label: "Discover Chefs", href: "/swipe" }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-4">
        <h1 className="text-2xl font-bold">Liked Chefs</h1>
        <p className="text-sm text-[var(--text-muted)]">{likes.length} saved</p>
      </div>

      <div className="p-4 space-y-3">
        {likes.map((like, idx) => (
          <motion.div
            key={like.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              href={`/cook/${like.swiped_id}`}
              className="flex items-center gap-4 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-[var(--primary)]/30 transition-colors group"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-2)]">
                {like.swiped?.avatar_url ? (
                  <Image src={like.swiped.avatar_url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">👨‍🍳</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{like.swiped?.full_name}</h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                  {like.swiped?.cuisines?.join(", ") || "Various cuisines"}
                </p>
                {like.swiped?.price_min && (
                  <p className="text-xs font-medium text-[var(--primary)] mt-0.5">
                    ₦{like.swiped.price_min.toLocaleString()}+
                  </p>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}