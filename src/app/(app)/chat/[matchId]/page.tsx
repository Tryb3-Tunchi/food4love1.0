"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  BadgeCheck,
  Calendar,
  Star,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { MOCK_CHEFS } from "@/lib/mockData";
import { formatNaira } from "@/lib/utils";

const MATCH_TO_CHEF: Record<string, string> = {
  "match-001": "chef-001",
  "match-002": "chef-002",
  "match-003": "chef-003",
};

interface Message {
  id: string;
  content: string;
  isOwn: boolean;
  time: string;
  type: "text" | "special";
  specialData?: { title: string; price: number; emoji: string };
}

const INITIAL_MESSAGES: Record<string, Message[]> = {
  "match-001": [
    {
      id: "1",
      content: "Hi Adaeze! I saw your Ofe Akwu special today 🍲",
      isOwn: true,
      time: "2:30 PM",
      type: "text",
    },
    {
      id: "2",
      content:
        "Hello! Yes it's fresh today — palm fruit I processed this morning. You interested?",
      isOwn: false,
      time: "2:31 PM",
      type: "text",
    },
    {
      id: "3",
      content: "Definitely! Can you do it for 2 people?",
      isOwn: true,
      time: "2:32 PM",
      type: "text",
    },
    {
      id: "4",
      content: "Yes of course! Pounded yam or starch? I also have eba",
      isOwn: false,
      time: "2:33 PM",
      type: "text",
    },
    {
      id: "5",
      content: "Pounded yam please! When can you have it ready?",
      isOwn: true,
      time: "2:34 PM",
      type: "text",
    },
    {
      id: "6",
      content: "Sounds great! I can have it ready by 6pm 🍲",
      isOwn: false,
      time: "2:35 PM",
      type: "text",
    },
  ],
  "match-002": [
    {
      id: "1",
      content:
        "Emeka your jollof is legendary! Ordering for my sister's birthday 🎉",
      isOwn: true,
      time: "11:00 AM",
      type: "text",
    },
    {
      id: "2",
      content: "Thank you! How many people are we feeding?",
      isOwn: false,
      time: "11:02 AM",
      type: "text",
    },
    {
      id: "3",
      content: "About 8 people",
      isOwn: true,
      time: "11:03 AM",
      type: "text",
    },
    {
      id: "4",
      content: "The party pack feeds 8 comfortably with rice and chicken",
      isOwn: false,
      time: "11:05 AM",
      type: "text",
    },
  ],
};

const AI_SUGGESTIONS = [
  "What's your specialty today?",
  "Are you available this weekend?",
  "Can you cater for 6 people?",
];

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  const chefId = MATCH_TO_CHEF[matchId] ?? "chef-001";
  const chef = MOCK_CHEFS.find((c) => c.id === chefId);

  const [messages, setMessages] = useState<Message[]>(
    INITIAL_MESSAGES[matchId] ?? []
  );
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(messages.length === 0);
  const [showBooking, setShowBooking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const send = (content: string) => {
    if (!content.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      isOwn: true,
      time: new Date().toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      type: "text",
    };
    setMessages((p) => [...p, msg]);
    setInput("");
    setShowSuggestions(false);

    // Simulate chef reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replies = [
        "That sounds great! Let me check my schedule 😊",
        "Yes I can do that! When do you need it by?",
        "Perfect! My prices start from " + formatNaira(chef?.price_min ?? 8000),
        "Thank you for reaching out! I'd love to cook for you 🍲",
      ];
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          content: replies[Math.floor(Math.random() * replies.length)],
          isOwn: false,
          time: new Date().toLocaleTimeString("en-NG", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          type: "text",
        },
      ]);
    }, 1500);
  };

  if (!chef) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <p style={{ color: "var(--text-3)" }}>Conversation not found</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: "var(--bg-2)" }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "var(--text-2)" }} />
        </button>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ background: "var(--bg-2)" }}
        >
          {chef.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="font-heading truncate text-sm font-semibold"
              style={{ color: "var(--text-1)" }}
            >
              {chef.full_name}
            </span>
            {chef.is_verified && (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--success)" }}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-0.5 text-xs"
              style={{ color: "var(--text-3)" }}
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {chef.rating}
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              ·
            </span>
            <span
              className="truncate text-xs"
              style={{ color: "var(--text-3)" }}
            >
              {chef.response_time}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowBooking(!showBooking)}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
          style={{ background: "var(--accent)" }}
        >
          <Calendar className="h-3.5 w-3.5" />
          Book
        </button>
      </div>

      {/* Booking banner */}
      <AnimatePresence>
        {showBooking && chef.daily_special && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div
              className="mx-4 mt-3 flex items-center justify-between rounded-2xl p-4"
              style={{
                background: "rgba(232,116,40,0.08)",
                border: "1px solid rgba(232,116,40,0.2)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍽</span>
                <div>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    Today's Special
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-1)" }}
                  >
                    {chef.daily_special.title}
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatNaira(chef.daily_special.price)}
                  </p>
                </div>
              </div>
              <button
                className="rounded-xl px-3 py-2 text-xs font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                Request
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {/* AI suggestions — shown when empty */}
        {showSuggestions && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl text-4xl"
              style={{ background: "var(--bg-2)" }}
            >
              {chef.emoji}
            </div>
            <div className="text-center">
              <p
                className="font-heading text-base font-bold"
                style={{ color: "var(--text-1)" }}
              >
                {chef.full_name}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                You matched! Say hello 👋
              </p>
            </div>

            <div
              className="w-full rounded-2xl p-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--accent)" }}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  AI Suggestions
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {AI_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all active:scale-[0.98]"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i < 3 ? 0 : 0.05 }}
            className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
          >
            {!msg.isOwn && (
              <div
                className="mr-2 mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ background: "var(--bg-2)" }}
              >
                {chef.emoji}
              </div>
            )}
            <div className="max-w-[72%]">
              <div
                className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: msg.isOwn ? "var(--accent)" : "var(--card)",
                  color: msg.isOwn ? "white" : "var(--text-1)",
                  border: msg.isOwn ? "none" : "1px solid var(--border)",
                  borderBottomRightRadius: msg.isOwn ? "4px" : undefined,
                  borderBottomLeftRadius: !msg.isOwn ? "4px" : undefined,
                }}
              >
                {msg.content}
              </div>
              <p
                className="mt-1 px-1 text-[10px]"
                style={{
                  color: "var(--text-3)",
                  textAlign: msg.isOwn ? "right" : "left",
                }}
              >
                {msg.time}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-end gap-2"
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ background: "var(--bg-2)" }}
              >
                {chef.emoji}
              </div>
              <div
                className="flex items-center gap-1 rounded-2xl px-4 py-3"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{
                      background: "var(--text-3)",
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="safe-bottom shrink-0 border-t"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Quick suggestions strip — show after first message */}
        {messages.length > 0 && messages.length < 4 && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
            {["What's your price?", "Available today?", "Can you deliver?"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-2)",
                  }}
                >
                  {s}
                </button>
              )
            )}
          </div>
        )}

        <div className="flex items-end gap-2 px-4 py-3">
          <div
            className="flex-1 overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Message..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
              style={{ color: "var(--text-1)", maxHeight: "96px" }}
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90 disabled:opacity-40"
            style={{
              background: input.trim() ? "var(--accent)" : "var(--bg-2)",
              boxShadow: input.trim()
                ? "0 4px 16px rgba(232,116,40,0.3)"
                : "none",
            }}
          >
            <Send
              className="h-4 w-4"
              style={{ color: input.trim() ? "white" : "var(--text-3)" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
