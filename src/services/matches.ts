import { createClient } from "@/lib/supabase/client";
import { Match } from "@/types/db";

const sb = () => createClient();

export async function createMatch(user1: string, user2: string): Promise<Match> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb()
    .from("matches")
    .insert({ user1_id: user1, user2_id: user2, status: "matched", expires_at: expiresAt })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMatches(userId: string): Promise<Match[]> {
  const { data } = await sb()
    .from("matches")
    .select(`*, other_user:profiles!matches_user2_id_fkey(*), last_message:messages(content, created_at)`)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq("status", "matched")
    .order("created_at", { ascending: false });
  return data ?? [];
}
