"use client";

import { useMatches } from "@/hooks/useMatches";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

export default function ChatIndexPage() {
  const { data: matches, isLoading } = useMatches();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="w-12 h-12" />}
        title="No matches yet"
        description="Start swiping to match with amazing home chefs!"
        action={{ label: "Discover Chefs", href: "/swipe" }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-4">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-[var(--text-muted)]">{matches.length} active {matches.length === 1 ? "match" : "matches"}</p>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {matches.map((match) => (
          <Link
            key={match.id}
            href={`/chat/${match.id}`}
            className="flex items-center gap-4 p-4 hover:bg-[var(--bg-2)]/50 transition-colors group"
          >
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-[var(--border)] flex-shrink-0">
              {match.other_user?.avatar_url ? (
                <Image src={match.other_user.avatar_url} alt="" fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--bg-2)] flex items-center justify-center text-xl">
                  {match.other_user?.role === "cook" ? "👨‍🍳" : "👤"}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-semibold text-[var(--text)] truncate">{match.other_user?.full_name || "User"}</h3>
                {match.last_message && (
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {formatDistanceToNow(new Date(match.last_message.created_at), { addSuffix: false })}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)] truncate group-hover:text-[var(--text)] transition-colors">
                {match.last_message ? (
                  <span className={match.last_message.read_at ? "" : "font-medium text-[var(--text)]"}>
                    {match.last_message.content}
                  </span>
                ) : (
                  "Start the conversation..."
                )}
              </p>
            </div>

            <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}