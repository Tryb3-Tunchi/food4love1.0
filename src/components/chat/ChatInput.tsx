"use client";
import { useState, useRef } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (msg: string) => void;
  loading?: boolean;
  suggestions?: string[];
}

export function ChatInput({ onSend, loading, suggestions }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(!!suggestions?.length);
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const msg = value.trim();
    if (!msg || loading) return;
    onSend(msg);
    setValue("");
    setShowSuggestions(false);
    ref.current?.focus();
  };

  return (
    <div className="border-t border-fog dark:border-coal bg-white dark:bg-smoke p-3 safe-bottom">
      {showSuggestions && suggestions?.length && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-none">
          {suggestions.map((s) => (
            <button key={s} onClick={() => { setValue(s); setShowSuggestions(false); }}
              className="shrink-0 rounded-full border border-pepper/30 bg-pepper/5 px-3 py-1 text-xs text-pepper hover:bg-pepper/10 transition-all">
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-xl border border-fog dark:border-coal bg-fog dark:bg-coal overflow-hidden">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Say something tasty..."
            rows={1}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-ink dark:text-cream placeholder:text-mist outline-none max-h-24"
            style={{ height: "auto" }}
          />
        </div>
        <button onClick={handleSend} disabled={!value.trim() || loading}
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all", value.trim() ? "bg-pepper text-white shadow-glow active:scale-95" : "bg-fog dark:bg-coal text-mist")}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
