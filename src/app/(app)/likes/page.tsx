"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heart } from "lucide-react";
import { formatNaira } from "@/lib/utils";

export default function LikesPage() {
  const profile = useAuthStore((s) => s.profile);
  const { data: likes, isLoading } = useQuery({
    queryKey: ["likes", profile?.id],
    queryFn: async () => {
      const { data } = await createClient().from("swipes").select("*, swiper:profiles!swipes_swiper_id_fkey(*)").eq("swiped_id", profile!.id).in("action", ["like","superlike"]).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="h-5 w-5 text-pepper" />
        <h1 className="text-xl font-bold text-white">People who liked you</h1>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_,i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
      ) : !likes?.length ? (
        <EmptyState icon="💛" title="No likes yet" description="Keep your profile updated to get more likes." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {likes.map((l: any) => {
            const user = l.swiper;
            if (!user) return null;
            return (
              <div key={l.id} className="rounded-2xl bg-smoke border border-white/5 p-4 flex flex-col items-center gap-2 text-center">
                <Avatar src={user.avatar_url} name={user.full_name} size="lg" verified={user.is_verified} />
                <span className="font-semibold text-white text-sm truncate w-full">{user.full_name}</span>
                {user.price_min && <span className="text-xs text-ember">{formatNaira(user.price_min)}+</span>}
                {l.action === "superlike" && <span className="text-xs text-ember">⭐ Superliked you</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
