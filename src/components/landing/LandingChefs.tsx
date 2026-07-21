'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Clock3, MapPin, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const FEATURED_CHEFS = [
  {
    name: 'Chef Adaeze',
    handle: 'Lekki',
    dish: 'Bitterleaf soup, white rice, plantain',
    rating: '4.9',
    reviews: '120 reviews',
    tone: 'bg-mint',
  },
  {
    name: 'Chef Fatima',
    handle: 'Ikeja',
    dish: 'Tuwo shinkafa and miyan kuka',
    rating: '4.9',
    reviews: '85 reviews',
    tone: 'bg-butter',
  },
  {
    name: 'Chef Tolu',
    handle: 'Yaba',
    dish: 'Party jollof, turkey, coleslaw',
    rating: '5.0',
    reviews: '98 reviews',
    tone: 'bg-lilac',
  },
]

export function LandingChefs() {
  return (
    <section
      id="chefs"
      className="bg-cream px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <Badge
              variant="pepper"
              size="md"
              className="mb-4 border-pepper/15 bg-blush text-pepper"
            >
              Featured on Food4Love
            </Badge>
            <h2
              data-gsap="heading-reveal"
              className="text-balance font-heading text-display-lg text-ink"
            >
              Real home chefs. Real meals. Ready near you.
            </h2>
            <p className="mt-4 text-base text-body leading-8 sm:text-lg">
              Every profile is verified, rated, and ready to chat. Browse by
              cuisine, neighbourhood, or tonight&apos;s craving.
            </p>
          </div>

          <Link href="/signup">
            <Button
              variant="secondary"
              size="lg"
              pill
              className="border-border/80 bg-white/85 text-ink hover:bg-ivory"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Browse all chefs
            </Button>
          </Link>
        </motion.div>

        <div
          className="grid grid-cols-1 gap-5 lg:grid-cols-12"
          data-gsap="card-group"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="lg:col-span-7"
          >
            <Card
              data-gsap="micro-card"
              className="overflow-hidden rounded-[2.25rem]"
            >
              <div className="grid h-full gap-0 md:grid-cols-[1.1fr_0.9fr]">
                <div className="bg-gradient-to-br from-mint via-sage/70 to-cream p-7 sm:p-8">
                  <Badge
                    variant="lime"
                    size="sm"
                    className="border-white/70 bg-white/80 text-meadow"
                  >
                    Chef spotlight
                  </Badge>
                  <h3 className="mt-4 font-heading text-3xl font-bold leading-tight text-ink sm:text-4xl">
                    Chef Adaeze&apos;s Sunday comfort menu. Soups, rice, and
                    portions for the whole house.
                  </h3>
                  <p className="mt-4 max-w-md text-body text-sm leading-7 sm:text-base">
                    Rich soups, clean plating, and portions for one, two, or a
                    full table. Delivery and pickup across Lekki, Lagos.
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
                      <p className="text-muted">Rating</p>
                      <p className="mt-1 flex items-center gap-2 font-semibold text-ink">
                        <Star className="h-4 w-4 fill-ember text-ember" />
                        4.9 from 120 reviews
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
                      <p className="text-muted">Best for</p>
                      <p className="mt-1 font-semibold text-ink">
                        Family lunch, slow Sundays
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between bg-white p-7 sm:p-8">
                  <div>
                    <div className="flex items-center gap-3">
                      <Avatar name="Chef Adaeze" size="lg" verified />
                      <div>
                        <p className="font-heading text-xl font-bold text-ink">
                          Chef Adaeze
                        </p>
                        <p className="text-body text-sm">Lekki, Lagos</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 text-sm">
                      {[
                        'Bitterleaf soup and white rice',
                        'Peppered goat meat add-on',
                        'Plantain and fresh juice option',
                      ].map((item) => (
                        <div
                          key={item}
                          className="rounded-[1.25rem] bg-surface-muted/70 px-4 py-3 text-body"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between rounded-[1.5rem] bg-ivory px-4 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        From
                      </p>
                      <p className="text-lg font-bold text-pepper">N8,000</p>
                    </div>
                    <Link href="/signup">
                      <Button
                        size="md"
                        pill
                        className="bg-meadow text-white hover:bg-herb"
                      >
                        Match now
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <div className="grid gap-5 lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
            >
              <Card
                data-gsap="micro-card"
                className="rounded-[2.25rem] bg-blush p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pepper/70">
                      Browse by mood
                    </p>
                    <h3 className="mt-3 font-heading text-2xl font-bold text-ink">
                      Find exactly what you&apos;re craving tonight.
                    </h3>
                  </div>
                  <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-pepper">
                    New
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[1.3rem] bg-white/85 p-4 text-body shadow-sm">
                    Tray specials
                  </div>
                  <div className="rounded-[1.3rem] bg-white/85 p-4 text-body shadow-sm">
                    Date night bowls
                  </div>
                  <div className="rounded-[1.3rem] bg-white/85 p-4 text-body shadow-sm">
                    Grill packs
                  </div>
                  <div className="rounded-[1.3rem] bg-white/85 p-4 text-body shadow-sm">
                    Pickup menus
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: 0.08 }}
            >
              <Card
                data-gsap="micro-card"
                className="rounded-[2.25rem] bg-mint p-7"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-meadow shadow-sm">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-2xl font-bold text-ink">
                      Verified, trusted, easy
                    </h3>
                    <p className="mt-1 text-body text-sm">
                      Cleaner trust cues and softer surfaces across the page.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between rounded-[1.3rem] bg-white/80 px-4 py-3">
                    <span className="text-body text-sm">
                      Chef identity verified
                    </span>
                    <span className="text-xs font-semibold text-meadow">
                      active
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[1.3rem] bg-white/80 px-4 py-3">
                    <span className="text-body text-sm">
                      Pickup and delivery windows
                    </span>
                    <Clock3 className="h-4 w-4 text-meadow" />
                  </div>
                  <div className="flex items-center justify-between rounded-[1.3rem] bg-white/80 px-4 py-3">
                    <span className="text-body text-sm">
                      Neighborhood-based discovery
                    </span>
                    <MapPin className="h-4 w-4 text-meadow" />
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        <div
          className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3"
          data-gsap="card-group"
        >
          {FEATURED_CHEFS.map((chef, index) => (
            <motion.div
              key={chef.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.08 }}
            >
              <Card
                data-gsap="micro-card"
                className={`h-full rounded-[2rem] ${chef.tone} p-6`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={chef.name} size="md" verified />
                  <div>
                    <p className="font-heading text-lg font-bold text-ink">
                      {chef.name}
                    </p>
                    <p className="text-body text-sm">{chef.handle}</p>
                  </div>
                </div>
                <p className="mt-5 text-lg font-semibold text-ink">
                  {chef.dish}
                </p>
                <div className="mt-6 flex items-center justify-between text-body text-sm">
                  <span className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-ember text-ember" />
                    {chef.rating}
                  </span>
                  <span>{chef.reviews}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
