"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMessages } from "@/hooks/useMessages";
import { useAuthStore } from "@/stores/useAuthStore";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { BookingModal } from "@/components/booking/BookingModal";

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role: "cook" | "buyer";
  bio?: string | null;
  location?: string | null;
  cuisines?: string[];
  photos?: string[];
  price_min?: number | null;
  price_max?: number | null;
  rating?: number | null;
  is_verified?: boolean;
}

interface MatchDetail {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  expires_at: string;
  user1: Profile;
  user2: Profile;
}

export default function ChatDetailPage() {
  const { matchId } = useParams();
  const { profile } = useAuthStore();
  const { messages, isLoading: messagesLoading, sendMessage } = useMessages(matchId as string);
  const [input, setInput] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // FETCH REAL MATCH + OTHER USER PROFILE
  const { data: matchDetail, isLoading: matchLoading } = useQuery<MatchDetail>({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          user1:profiles!matches_user1_id_fkey(id, full_name, avatar_url, role, bio, location, cuisines, photos, price_min, price_max, rating, is_verified),
          user2:profiles!matches_user2_id_fkey(id, full_name, avatar_url, role, bio, location, cuisines, photos, price_min, price_max, rating, is_verified)
        `)
        .eq("id", matchId)
        .single();

      if (error) throw error;
      return data as unknown as MatchDetail;
    },
    enabled: !!matchId,
  });

  // otherUser = the person you're chatting with
  const otherUser: Profile | null = matchDetail
    ? matchDetail.user1_id === profile?.id
      ? matchDetail.user2
      : matchDetail.user1
    : null;

  const isCook = otherUser?.role === "cook";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage.mutateAsync(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = messagesLoading || matchLoading;

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--bg)]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href="/chat" className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-2)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text)]" />
        </Link>

        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--border)] flex-shrink-0 bg-[var(--bg-2)]">
          {otherUser?.avatar_url ? (
            <Image src={otherUser.avatar_url} alt={otherUser.full_name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">{isCook ? "👨‍🍳" : "👤"}</div>
          )}
          {otherUser?.is_verified && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[var(--success)] rounded-full border-2 border-[var(--bg)] flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">✓</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-[var(--text)] truncate">{otherUser?.full_name || "Loading..."}</h2>
          <p className="text-xs text-[var(--success)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            {isCook ? "Verified Home Chef" : "Food Lover"}
          </p>
        </div>

        {isCook && (
          <button
            onClick={() => setShowBooking(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            Book Meal
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="w-2/3 h-12 bg-[var(--bg-2)] rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-2)] flex items-center justify-center text-3xl">💬</div>
            <h3 className="font-semibold text-[var(--text)]">Start chatting</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-[200px]">
              Say hello to {otherUser?.full_name || "your match"} and plan your meal!
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === profile?.id;
              const showDate =
                idx === 0 ||
                format(new Date(msg.created_at), "yyyy-MM-dd") !==
                format(new Date(messages[idx - 1].created_at), "yyyy-MM-dd");

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-2)] px-3 py-1 rounded-full">
                        {format(new Date(msg.created_at), "MMMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe
                          ? "bg-[var(--primary)] text-white rounded-br-md"
                          : "bg-[var(--bg-2)] text-[var(--text)] rounded-bl-md border border-[var(--border)]"
                        }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"} px-1`}>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {format(new Date(msg.created_at), "h:mm a")}
                      {isMe && msg.read_at && " · Read"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 bg-[var(--bg)] border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-end gap-2 bg-[var(--bg-2)] rounded-2xl border border-[var(--border)] px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-32 py-1.5 min-h-[20px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="p-2.5 bg-[var(--primary)] rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      {otherUser && profile?.id && (
        <BookingModal
          isOpen={showBooking}
          onClose={() => setShowBooking(false)}
          cook={{
            id: otherUser.id,
            full_name: otherUser.full_name,
            avatar_url: otherUser.avatar_url || undefined,
            daily_specials: [],
            price_min: otherUser.price_min || 2500,
          }}
          matchId={matchId as string}
          buyerId={profile.id}
        />
      )}
    </div>
  );
}