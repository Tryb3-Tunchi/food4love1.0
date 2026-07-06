"use client";
import { motion } from "framer-motion";

const STATS = [
  { value: "2,400+", label: "Verified home chefs", emoji: "👨‍🍳" },
  { value: "10k+", label: "Swipes this week", emoji: "💛" },
  { value: "847", label: "Matches made", emoji: "❤️" },
  { value: "4.9★", label: "Average chef rating", emoji: "⭐" },
];

export function LandingStats() {
  return (
    <section className="bg-ink px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <h2 className="mb-3 text-display-md text-white">The numbers speak</h2>
          <p className="text-base text-mist">
            Growing every single day across Nigeria.
          </p>
        </motion.div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:bg-white/10"
            >
              <div className="mb-2 text-3xl">{s.emoji}</div>
              <div className="mb-1 text-4xl font-extrabold tracking-tight text-white">
                {s.value}
              </div>
              <div className="text-sm text-mist">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
