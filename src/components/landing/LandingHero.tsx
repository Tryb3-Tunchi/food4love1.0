'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const QUICK_PICKS = [
  { label: 'Sunday soups', tone: 'bg-mint text-meadow' },
  { label: 'Date night trays', tone: 'bg-lilac text-ink' },
  { label: 'Office lunch', tone: 'bg-butter text-ink' },
  { label: 'Fresh swallows', tone: 'bg-blush text-ink' },
  { label: 'Small chops', tone: 'bg-sky text-ink' },
  { label: 'Family bowls', tone: 'bg-sage text-meadow' },
]

const APP_CARDS = [
  {
    name: 'Chef Adaeze',
    dish: 'Bitterleaf soup, white rice',
    meta: '24 min away',
    tone: 'bg-mint',
  },
  {
    name: 'Chef Fatima',
    dish: 'Tuwo, miyan kuka, lamb',
    meta: 'Pickup available',
    tone: 'bg-butter',
  },
  {
    name: 'Chef Tolu',
    dish: 'Party jollof, grilled turkey',
    meta: '4.9 rated',
    tone: 'bg-lilac',
  },
]

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24 lg:pt-12">
      <div className="ambient-bg">
        <div className="ambient-orb left-[8%] top-16 h-48 w-48 bg-mint/90" />
        <div className="ambient-orb right-[10%] top-24 h-56 w-56 bg-blush/70" />
        <div className="ambient-orb bottom-10 left-1/3 h-64 w-64 bg-sage/70" />
      </div>

      <motion.div
        animate={{ x: [0, 10, 0], y: [0, -8, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="landing-cloud pointer-events-none left-[6%] top-28 hidden h-12 w-28 sm:block"
      />
      <motion.div
        animate={{ x: [0, -8, 0], y: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="landing-cloud pointer-events-none right-[8%] top-40 hidden h-14 w-32 lg:block"
      />

      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <Badge
              variant="lime"
              size="md"
              className="mb-5 border-sage/80 bg-mint text-meadow"
            >
              Home chefs, not generic takeout
            </Badge>
          </motion.div>

          <h1
            data-gsap="heading-reveal"
            className="text-balance font-heading text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.05em] text-ink sm:text-[3.7rem] lg:text-[4.8rem]"
          >
            Find home-cooked meals that feel soft, warm, and made for you.
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.18 }}
            className="mt-5 max-w-xl text-base text-body leading-8 sm:text-lg"
          >
            Food4Love helps you discover nearby home chefs, match with the ones
            you love, chat directly, and get comforting meals for every mood.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.28 }}
            className="mt-8 flex flex-col items-start gap-3 sm:flex-row"
          >
            <Link href="/signup">
              <Button
                size="xl"
                pill
                className="bg-pepper text-white shadow-[0_16px_40px_rgba(232,90,42,0.22)] hover:bg-[#d4330c]"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Find a chef
              </Button>
            </Link>
            <Link href="/signup?role=cook">
              <Button
                variant="secondary"
                size="xl"
                pill
                className="border-border/80 bg-white/80 text-ink hover:bg-ivory"
              >
                Cook and earn
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.38 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <div className="flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-body text-sm shadow-card">
              <ShieldCheck className="h-4 w-4 text-meadow" />
              2,400+ verified home chefs
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-body text-sm shadow-card">
              <Star className="h-4 w-4 fill-ember text-ember" />
              4.9 average chef rating
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-body text-sm shadow-card">
              <Clock3 className="h-4 w-4 text-pepper" />
              Pickup or delivery
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative mx-auto w-full max-w-[38rem]"
        >
          <div
            data-gsap="hero-plate"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-gradient-to-br from-white/60 via-ivory/80 to-blush/40 shadow-[0_20px_60px_rgba(91,57,45,0.08)]"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-4 top-12 z-20 hidden rounded-[1.5rem] bg-white/90 p-4 shadow-float sm:block"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush text-pepper">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Chef Adaeze matched
                </p>
                <p className="text-xs text-muted">
                  Sunday tray ready in 24 mins
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-1 bottom-12 z-20 hidden rounded-[1.5rem] bg-white/90 p-4 shadow-float lg:block"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-meadow">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Direct chef chat
                </p>
                <p className="text-xs text-muted">
                  Custom spice, sides, portions
                </p>
              </div>
            </div>
          </motion.div>

          <div className="relative overflow-hidden rounded-[2.75rem] border border-border/90 bg-white/80 p-3 shadow-float backdrop-blur-xl">
            <div className="rounded-[2.15rem] bg-gradient-to-b from-white to-cream p-4 sm:p-5">
              <div className="rounded-[1.6rem] bg-surface p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Food4Love
                    </p>
                    <h3 className="mt-1 font-heading text-xl font-bold text-ink">
                      Discover your next favorite chef
                    </h3>
                  </div>
                  <div className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-meadow">
                    Live in Lagos
                  </div>
                </div>

                <div className="mt-4 rounded-[1.4rem] bg-ivory p-3">
                  <div className="flex items-center justify-between rounded-[1rem] bg-white px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-xs text-muted">
                        Tonight&apos;s craving
                      </p>
                      <p className="text-sm font-semibold text-ink">
                        Warm bowls, grilled sides, small chops
                      </p>
                    </div>
                    <MapPin className="h-4 w-4 text-meadow" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Spicy', 'Low oil', 'Family size', 'Fast pickup'].map(
                      (chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-white px-3 py-1.5 text-body text-xs font-medium shadow-sm"
                        >
                          {chip}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-3" data-gsap="card-group">
                  {APP_CARDS.map((card) => (
                    <div
                      key={card.name}
                      data-gsap="micro-card"
                      className={`flex items-center gap-3 rounded-[1.35rem] ${card.tone} p-3.5`}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-white/80 text-sm font-bold text-ink shadow-sm">
                        {card.name.split(' ')[1]?.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {card.name}
                        </p>
                        <p className="truncate text-body text-sm">
                          {card.dish}
                        </p>
                      </div>
                      <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                        {card.meta}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto mt-14 max-w-7xl overflow-hidden">
        <div className="landing-marquee landing-marquee-left pr-4">
          {[...QUICK_PICKS, ...QUICK_PICKS].map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className={`flex min-w-[13rem] items-center justify-between gap-4 rounded-[1.75rem] border border-white/70 ${item.tone} px-5 py-4 shadow-card`}
            >
              <span className="text-sm font-semibold">{item.label}</span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-body text-xs font-semibold">
                popular
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
