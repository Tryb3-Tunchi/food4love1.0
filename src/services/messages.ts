import { createClient } from "@/lib/supabase/client";
import { Message } from "@/types/db";

const sb = () => createClient();

export async function getMessages(matchId: string): Promise<Message[]> {
  const { data } = await sb()
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function sendMessage(matchId: string, senderId: string, content: string): Promise<Message> {
  const { data, error } = await sb()
    .from("messages")
    .insert({ match_id: matchId, sender_id: senderId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markMessagesRead(matchId: string, userId: string) {
  await sb()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .neq("sender_id", userId)
    .is("read_at", null);
}
