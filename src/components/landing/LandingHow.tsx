"use client";
import { motion } from "framer-motion";

const STEPS = [
  {
    number: "01",
    emoji: "👆",
    title: "Swipe through chefs",
    desc: "Browse home chefs near you. Each card shows their specialty, cuisine, price range and rating. Swipe right if you like what you see.",
    color: "bg-pepper/5 border-pepper/15",
    numColor: "text-pepper",
  },
  {
    number: "02",
    emoji: "❤️",
    title: "Get matched",
    desc: "When a chef likes you back — it's a match. You have 24 hours to say hi before it expires. No pressure, just real connection.",
    color: "bg-ember/5 border-ember/15",
    numColor: "text-ember",
  },
  {
    number: "03",
    emoji: "💬",
    title: "Chat & book",
    desc: "Message your match, discuss the meal you want, agree on a time and price. Our AI even suggests opening lines so you never freeze.",
    color: "bg-lime/5 border-lime/20",
    numColor: "text-lime",
  },
  {
    number: "04",
    emoji: "🍽️",
    title: "Eat & rate",
    desc: "Enjoy home-cooked food made with love. Rate your chef, leave a review, and come back for more. Your next favourite cook is a swipe away.",
    color: "bg-pepper/5 border-pepper/15",
    numColor: "text-pepper",
  },
];

export function LandingHow() {
  return (
    <section id="how" className="bg-surface-muted px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center sm:mb-16"
        >
          <span className="inline-block text-sm font-bold text-pepper bg-pepper/10 border border-pepper/20 rounded-full px-4 py-1.5 mb-4">
            How it works
          </span>
          <h2 className="text-display-lg text-ink mb-4 text-balance">
            Four steps to your best meal
          </h2>
          <p className="mx-auto max-w-2xl text-base text-body sm:text-lg">
            From discovery to delivery — the whole process is designed to feel natural, fast, and delicious.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex gap-5 rounded-[1.5rem] border bg-card p-6 transition-all hover:shadow-lift sm:p-7 ${step.color}`}
            >
              <div className="shrink-0">
                <span className={`text-4xl font-extrabold ${step.numColor} opacity-20 leading-none`}>
                  {step.number}
                </span>
              </div>
              <div>
                <div className="text-3xl mb-3">{step.emoji}</div>
                <h3 className="text-xl font-bold text-ink mb-2">{step.title}</h3>
                <p className="text-body text-sm leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}