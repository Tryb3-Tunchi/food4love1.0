import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Role = "buyer" | "cook";

export function RoleSelectPage() {
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const ROLES: {
    id: Role;
    emoji: string;
    title: string;
    subtitle: string;
    bullets: string[];
    accent: string;
    border: string;
    bg: string;
    check: string;
  }[] = [
    {
      id: "buyer",
      emoji: "🍽️",
      title: "I want food",
      subtitle: "Find a cook, get a meal",
      bullets: [
        "Browse home cooks near you",
        "Match with your taste",
        "Book a meal, no stress",
      ],
      accent: "text-punch-600 dark:text-punch-400",
      border: "border-punch-400/60",
      bg: "bg-punch-500/8 dark:bg-punch-500/12",
      check: "bg-punch-500",
    },
    {
      id: "cook",
      emoji: "👩‍🍳",
      title: "I can cook",
      subtitle: "Share your food, earn money",
      bullets: [
        "Showcase your specialty",
        "Get matched with buyers",
        "Cook what you love",
      ],
      accent: "text-brand-700 dark:text-brand-300",
      border: "border-brand-400/60",
      bg: "bg-brand-500/8 dark:bg-brand-500/12",
      check: "bg-brand-500",
    },
  ];

  const handleContinue = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile({ role: selected });
      navigate("/setup", { replace: true });
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-5 py-10">
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Food4Love
        </div>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-slate-900 dark:text-zinc-50">
          What brings you<br />to Food4Love?
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          This determines your experience. You can&apos;t change this later.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ROLES.map((r) => {
          const isActive = selected === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              className={[
                "relative w-full rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98]",
                isActive
                  ? `${r.border} ${r.bg} shadow-lg`
                  : "border-black/10 bg-white shadow-sm hover:border-black/20 hover:shadow dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-800 text-3xl">
                  {r.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={["text-lg font-bold", isActive ? r.accent : "text-slate-900 dark:text-zinc-100"].join(" ")}>
                    {r.title}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                    {r.subtitle}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                        <span className={["flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white text-[9px] font-bold", isActive ? r.check : "bg-slate-200 dark:bg-zinc-700"].join(" ")}>
                          ✓
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={[
                  "flex-shrink-0 h-5 w-5 rounded-full border-2 transition-all mt-1",
                  isActive
                    ? `${r.check} border-transparent flex items-center justify-center`
                    : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-slate-900",
                ].join(" ")}>
                  {isActive ? (
                    <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected || isSaving}
          className={[
            "w-full rounded-2xl py-4 text-base font-bold transition-all duration-200 active:scale-[0.98]",
            selected
              ? "bg-slate-900 text-white shadow-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-slate-900 dark:hover:bg-white"
              : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600",
          ].join(" ")}
        >
          {isSaving ? "Saving…" : selected ? "Continue" : "Select one to continue"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-400 dark:text-zinc-600">
          Your role is permanent after this step
        </p>
      </div>
    </div>
  );
}
