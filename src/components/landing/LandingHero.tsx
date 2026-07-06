"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Star, MapPin } from "lucide-react";

// Animated food emoji cards — no external images needed
// These float around the hero and give it life and warmth
const FOOD_CARDS = [
  { emoji: "🍲", label: "Ofe Onugbu", chef: "Ada C.", rating: "4.9", top: "12%", left: "4%",  delay: 0 },
  { emoji: "🍛", label: "Party Jollof", chef: "Emeka T.", rating: "5.0", top: "55%", left: "2%",  delay: 0.3 },
  { emoji: "🥘", label: "Egusi Soup",  chef: "Ngozi A.", rating: "4.8", top: "20%", right: "4%", delay: 0.15 },
  { emoji: "🍖", label: "Peppered Goat", chef: "Kunle M.", rating: "4.9", top: "60%", right: "2%", delay: 0.45 },
];

const AVATARS = ["👩🏿", "👨🏿", "👩🏾", "👨🏾", "🧑🏿"];

export function LandingHero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col items-center justify-center px-5 py-20 overflow-hidden">

      {/* Warm background blobs — subtle, not dark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-ember/10 blur-[80px]" />
        <div className="absolute bottom-[-5%] right-[15%] h-[400px] w-[400px] rounded-full bg-pepper/8 blur-[80px]" />
        <div className="absolute top-[40%] left-[-5%] h-[300px] w-[300px] rounded-full bg-lime/5 blur-[60px]" />
      </div>

      {/* Floating food cards — desktop only */}
      {FOOD_CARDS.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: card.delay + 0.8, duration: 0.6 }}
          style={{
            top: card.top,
            left: card.left ?? undefined,
            right: card.right ?? undefined,
            animationDelay: `${card.delay}s`,
          }}
          className="absolute hidden lg:flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-lift border border-biscuit animate-float"
        >
          <span className="text-3xl">{card.emoji}</span>
          <div>
            <p className="text-sm font-bold text-ink leading-tight">{card.label}</p>
            <p className="text-xs text-muted leading-tight">by {card.chef}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="h-3 w-3 fill-ember text-ember" />
              <span className="text-xs font-semibold text-ember">{card.rating}</span>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Main hero content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">

        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-pepper/10 border border-pepper/20 rounded-full px-4 py-1.5 mb-8"
        >
          <span className="h-2 w-2 rounded-full bg-pepper animate-pulse-soft" />
          <span className="text-sm font-semibold text-pepper">Now live in Lagos, Abuja & Port Harcourt</span>
        </motion.div>

        {/* Main headline — Chowdeck energy: massive, black, confident */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-[3.5rem] md:text-[5.5rem] font-extrabold leading-[1.0] tracking-[-0.03em] text-ink mb-6 text-balance"
        >
          Find someone
          <br />
          who'll{" "}
          <span className="gradient-text">cook</span>
          <br />
          for you.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg md:text-xl text-body max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Match with talented home chefs near you. Real food, real people.
          No restaurants. No middlemen. Just great cooking.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 bg-pepper text-white font-bold text-base px-8 py-4 rounded-full hover:bg-pepper/90 active:scale-95 transition-all shadow-warm"
          >
            Start Swiping
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/signup?role=cook"
            className="inline-flex items-center gap-2 bg-white text-ink font-bold text-base px-8 py-4 rounded-full border-2 border-biscuit hover:border-pepper/30 hover:bg-warmgray active:scale-95 transition-all shadow-lift"
          >
            🍳 Become a Chef
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted"
        >
          {/* Avatar cluster */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {AVATARS.map((av, i) => (
                <span
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-warmgray border-2 border-cream text-base"
                >
                  {av}
                </span>
              ))}
            </div>
            <span className="font-medium text-body">2,400+ chefs ready to cook</span>
          </div>

          <span className="hidden sm:block text-biscuit">·</span>

          <div className="flex items-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-ember text-ember" />
            ))}
            <span className="font-semibold text-body">4.9 average rating</span>
          </div>
        </motion.div>
      </div>

      {/* City marker strip — grounded Nigerian context */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 flex-wrap px-4"
      >
        {["📍 Lagos", "📍 Abuja", "📍 Port Harcourt", "📍 Ibadan"].map((city) => (
          <span key={city} className="text-xs font-medium text-muted bg-white border border-biscuit rounded-full px-3 py-1.5 shadow-sm">
            {city}
          </span>
        ))}
      </motion.div>
    </section>
  );
}