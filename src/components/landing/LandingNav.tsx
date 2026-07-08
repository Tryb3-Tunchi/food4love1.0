"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ChefHat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HungerModeToggle } from "@/components/ui/HungerModeToggle";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-[color:var(--bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pepper shadow-warm">
            <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-ink">
            Food<span className="text-pepper">4</span>Love
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
          <Link
            href="#how"
            className="text-sm font-medium text-body transition-colors hover:text-ink"
          >
            How it works
          </Link>
          <Link
            href="#chefs"
            className="text-sm font-medium text-body transition-colors hover:text-ink"
          >
            Browse Chefs
          </Link>
          <Link
            href="/signup?role=cook"
            className="text-sm font-medium text-body transition-colors hover:text-ink"
          >
            Become a Chef
          </Link>
        </div>

        {/* Right side */}
        <div className="hidden items-center gap-3 md:flex">
          <HungerModeToggle />
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-semibold text-body transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-pepper px-5 py-2.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-[#D4330C] active:scale-95"
          >
            Start Swiping →
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <HungerModeToggle />
          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-muted"
          >
            {open ? (
              <X className="h-5 w-5 text-ink" />
            ) : (
              <Menu className="h-5 w-5 text-ink" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border bg-[color:var(--bg)] md:hidden"
          >
            <div className="flex flex-col gap-2 px-5 py-4">
              <Link
                href="#how"
                onClick={() => setOpen(false)}
                className="border-b border-biscuit py-2.5 text-base font-medium text-body"
              >
                How it works
              </Link>
              <Link
                href="#chefs"
                onClick={() => setOpen(false)}
                className="border-b border-biscuit py-2.5 text-base font-medium text-body"
              >
                Browse Chefs
              </Link>
              <Link
                href="/signup?role=cook"
                onClick={() => setOpen(false)}
                className="border-b border-biscuit py-2.5 text-base font-medium text-body"
              >
                Become a Chef
              </Link>
              <div className="flex flex-col gap-2.5 pt-3">
                <Link
                  href="/login"
                  className="rounded-full border border-border bg-card py-3 text-center text-sm font-semibold text-ink"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-pepper py-3 text-center text-sm font-bold text-white shadow-warm"
                >
                  Start Swiping →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
