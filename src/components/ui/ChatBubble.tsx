import type { Message } from "../../types/db";

type Props = {
  message: Message;
  isMine: boolean;
};

export function ChatBubble({ message, isMine }: Props) {
  return (
    <div
      className={["flex", isMine ? "justify-end" : "justify-start"].join(" ")}
    >
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isMine
            ? "bg-gradient-to-r from-brand-400 via-brand-500 to-punch-500 text-slate-950"
            : "bg-black/5 text-slate-900 dark:bg-white/10 dark:text-white",
        ].join(" ")}
      >
        <div>{message.body}</div>
        <div
          className={[
            "mt-1 text-[11px] opacity-70",
            isMine ? "text-zinc-900" : "text-slate-600 dark:text-zinc-300",
          ].join(" ")}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
