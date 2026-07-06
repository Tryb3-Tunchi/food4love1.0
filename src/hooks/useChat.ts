import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Message } from "../types/db";

type UseChatState = {
  isLoading: boolean;
  messages: Message[];
  sendMessage: (body: string) => Promise<void>;
};

export function useChat(params: {
  matchId: string;
  userId: string | null;
}): UseChatState {
  const { matchId, userId } = params;
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!isActive) return;
      setMessages((data as Message[]) ?? []);
      setIsLoading(false);
    };

    load().catch(() => {});

    return () => {
      isActive = false;
    };
  }, [matchId]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const next = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [matchId]);

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: userId,
        body: trimmed,
      });
      if (error) throw error;

      await supabase.functions
        .invoke("groq-bot", {
          body: { matchId },
        })
        .catch(() => {});
    },
    [matchId, userId],
  );

  return useMemo(
    () => ({ isLoading, messages, sendMessage }),
    [isLoading, messages, sendMessage],
  );
}
