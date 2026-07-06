import { createClient } from "@/lib/supabase/client";
import { SwipeAction } from "@/types/db";

const sb = () => createClient();

export async function recordSwipe(swiperId: string, swipedId: string, action: SwipeAction) {
  const { error } = await sb().from("swipes").insert({ swiper_id: swiperId, swiped_id: swipedId, action });
  if (error) throw error;
}

export async function checkMutualLike(user1: string, user2: string): Promise<boolean> {
  const { data } = await sb()
    .from("swipes")
    .select("id")
    .eq("swiper_id", user2)
    .eq("swiped_id", user1)
    .in("action", ["like", "superlike"])
    .single();
  return !!data;
}
