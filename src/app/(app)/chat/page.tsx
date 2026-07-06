"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, X, ChevronRight, BadgeCheck } from "lucide-react";
import { MOCK_CHEFS } from "@/lib/mockData";
import { useRouter } from "next/navigation";

const MOCK_CONVERSATIONS = [
  {
    matchId: "match-001",
    chefId: "chef-001",
    lastMessage: "Sounds great! I can have it ready by 6pm 🍲",
    time: "2m ago",
    unread: 2,
    isNew: false,
  },
  {
    matchId: "match-002",
    chefId: "chef-002",
    lastMessage: "The party pack feeds 8 comfortably with rice and chicken",
    time: "1h ago",
    unread: 0,
    isNew: false,
  },
  {
    matchId: "match-003",
    chefId: "chef-003",
    lastMessage: null,
    time: "just now",
    unread: 0,
    isNew: true,
  },
];

export default function ChatIndexPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const conversations = MOCK_CONVERSATIONS.filter((c) => {
    const chef = MOCK_CHEFS.find((ch) => ch.id === c.chefId);
    return (
      search === "" ||
      chef?.full_name.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pb-4 pt-6">
        <h1
          className="font-heading mb-4 text-2xl font-bold"
          style={{ color: "var(--text-1)" }}
        >
          Messages
        </h1>
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--text-3)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-1)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="h-4 w-4" style={{ color: "var(--text-3)" }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-24">
        {conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <span className="mb-4 text-6xl">💬</span>
            <h3
              className="font-heading mb-2 text-lg font-bold"
              style={{ color: "var(--text-1)" }}
            >
              No conversations yet
            </h3>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              Match with a chef to start chatting
            </p>
            <button
              onClick={() => router.push("/swipe")}
              className="mt-6 rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{ background: "var(--accent)" }}
            >
              Discover Chefs →
            </button>
          </motion.div>
        ) : (
          conversations.map((convo, i) => {
            const chef = MOCK_CHEFS.find((c) => c.id === convo.chefId);
            if (!chef) return null;

            return (
              <motion.button
                key={convo.matchId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/chat/${convo.matchId}`)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.99]"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 3px rgba(47,36,31,0.04)",
                }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="h-13 w-13 flex items-center justify-center rounded-2xl text-2xl"
                    style={{ background: "var(--bg-2)", width: 52, height: 52 }}
                  >
                    {chef.emoji}
                  </div>
                  {chef.is_verified && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2"
                      style={{
                        background: "var(--success)",
                        borderColor: "var(--card)",
                      }}
                    >
                      <BadgeCheck
                        className="h-3 w-3 text-white"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                  {convo.isNew && (
                    <div
                      className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2"
                      style={{
                        background: "var(--accent)",
                        borderColor: "var(--card)",
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: "var(--text-1)",
                        fontWeight: convo.unread > 0 ? 700 : 600,
                      }}
                    >
                      {chef.full_name}
                    </span>
                    <span
                      className="ml-2 shrink-0 text-xs"
                      style={{ color: "var(--text-3)" }}
                    >
                      {convo.time}
                    </span>
                  </div>
                  <p
                    className="truncate text-xs"
                    style={{
                      color: convo.isNew ? "var(--accent)" : "var(--text-3)",
                      fontWeight: convo.unread > 0 ? 600 : 400,
                    }}
                  >
                    {convo.isNew ? "✨ New match — say hi!" : convo.lastMessage}
                  </p>
                </div>

                {/* Unread / arrow */}
                <div className="flex shrink-0 items-center gap-2">
                  {convo.unread > 0 ? (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      {convo.unread}
                    </span>
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 opacity-30"
                      style={{ color: "var(--text-2)" }}
                    />
                  )}
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
