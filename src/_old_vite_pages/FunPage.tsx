import { useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const prompts = [
  {
    title: "Tonight’s vibe",
    body: "Pick one: spicy noodles, smash burgers, sushi, or tacos. No overthinking.",
  },
  {
    title: "Food dare",
    body: "Message your match: “Two truths and a lie — but all about food.”",
  },
  {
    title: "Chef’s roulette",
    body: "Order something you’ve never tried before. Rate it 1–10 after.",
  },
  {
    title: "Mini date idea",
    body: "Coffee + a bakery stop. Swap one bite each and judge politely.",
  },
];

export function FunPage() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 10_000));

  const item = useMemo(() => {
    const index = seed % prompts.length;
    return prompts[index];
  }, [seed]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Fun
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            Little boosts to keep things moving
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => setSeed(Math.floor(Math.random() * 10_000))}
        >
          Shuffle
        </Button>
      </header>

      <Card className="p-5">
        <div className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
          {item.title}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          {item.body}
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setSeed(Math.floor(Math.random() * 10_000))}
          >
            Give me another
          </Button>
        </div>
      </Card>
    </div>
  );
}
