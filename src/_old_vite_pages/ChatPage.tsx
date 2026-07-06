import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ChatBubble } from "../components/ui/ChatBubble";
import { useAuth } from "../hooks/useAuth";
import { useChat } from "../hooks/useChat";

export function ChatPage() {
  const params = useParams();
  const matchId = params.matchId ?? "";
  const { user } = useAuth();
  const { isLoading, messages, sendMessage } = useChat({
    matchId,
    userId: user?.id ?? null,
  });
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!matchId) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
        <Card className="p-4">
          <div className="text-sm text-slate-700 dark:text-zinc-200">
            Missing match id.
          </div>
          <Link className="mt-2 inline-block text-sm" to="/matches">
            Back to matches
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Chat
          </div>
          <div className="text-xs break-all text-slate-600 dark:text-zinc-400">
            {matchId}
          </div>
        </div>
        <Link to="/matches">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <Card className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex-1 space-y-3 overflow-auto">
          {isLoading ? (
            <div className="text-sm text-slate-600 dark:text-zinc-300">
              Loading…
            </div>
          ) : null}
          {!isLoading && messages.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-zinc-300">
              Say hi.
            </div>
          ) : null}
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              isMine={m.sender_id === user?.id}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canSend) return;
            await sendMessage(draft);
            setDraft("");
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message"
            className="flex-1 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none ring-brand-400/40 focus:ring-2 dark:border-white/15 dark:bg-white/6 dark:text-zinc-100"
          />
          <Button type="submit" variant="primary" disabled={!canSend}>
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
}
