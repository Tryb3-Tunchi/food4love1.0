import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          user1:profiles!matches_user1_id_fkey(id, full_name, avatar_url, role),
          user2:profiles!matches_user2_id_fkey(id, full_name, avatar_url, role),
          last_message:messages(content, created_at, sender_id)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq("status", "matched")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((match) => {
        const otherUser = match.user1_id === user.id ? match.user2 : match.user1;
        return {
          ...match,
          other_user: otherUser,
          last_message: match.last_message?.[0] || null,
        };
      });
    },
    refetchInterval: 5000,
  });
}