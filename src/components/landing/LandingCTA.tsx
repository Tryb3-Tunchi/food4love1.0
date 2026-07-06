"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="bg-cream px-5 py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] bg-pepper p-10 text-center md:p-16"
        >
          {/* Warm glow inside the card */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 bg-ember/30 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-6 text-5xl">🍽️</div>
            <h2 className="mb-4 text-balance text-display-md text-white">
              Ready to eat something made with love?
            </h2>
            <p className="mx-auto mb-10 max-w-md text-lg text-white/70">
              Join thousands of food lovers already matching with home chefs
              across Nigeria. Free to join, no subscription.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-pepper shadow-float transition-all hover:bg-cream active:scale-95"
              >
                Start for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/signup?role=cook"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                🍳 Cook & Earn
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
