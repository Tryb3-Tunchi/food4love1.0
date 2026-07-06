import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: Props) {
  return (
    <div
      className={[
        "rounded-2xl border border-black/10 bg-white/80 text-slate-900 shadow-[0_18px_40px_-18px_rgba(2,6,23,0.18)] backdrop-blur dark:border-white/[0.07] dark:bg-slate-900/85 dark:text-zinc-100 dark:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)]",
        className ?? "",
      ].join(" ")}
      {...props}
    />
  );
}
