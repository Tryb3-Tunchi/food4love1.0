'use client'

import { motion } from 'framer-motion'
import { ChefHat, Heart, MessageCircle, ShoppingBag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

const DISCOVERY_RAIL = [
  {
    title: 'Soups and swallows',
    copy: 'Comfort food for slow evenings',
    tone: 'bg-mint',
  },
  {
    title: 'Small chops trays',
    copy: 'Friendly hosting made easy',
    tone: 'bg-blush',
  },
  {
    title: 'Lunch packs',
    copy: 'Office meals that feel homemade',
    tone: 'bg-sky',
  },
  {
    title: 'Date night specials',
    copy: 'Cute dinners, plated beautifully',
    tone: 'bg-lilac',
  },
  {
    title: 'Sunday rice bowls',
    copy: 'Warm portions for the whole house',
    tone: 'bg-butter',
  },
]

const DISCOVERY_RAIL_ALT = [
  {
    title: 'Pepper soup nights',
    copy: 'Rich broths, grilled protein',
    tone: 'bg-ivory',
  },
  { title: 'Asun and grills', copy: 'Weekend sharing plates', tone: 'bg-sage' },
  {
    title: 'Family pots',
    copy: 'Big batches for home delivery',
    tone: 'bg-parchment',
  },
  { title: 'Healthy picks', copy: 'Lighter meals, same soul', tone: 'bg-mint' },
  {
    title: 'Chef specials',
    copy: 'Limited menus, chef-curated',
    tone: 'bg-blush',
  },
]

const STEPS = [
  {
    icon: <ShoppingBag className="h-5 w-5" />,
    title: 'Browse by mood',
    copy: 'Explore chefs and dishes by craving, vibe, event, or how quickly you need dinner sorted.',
    tone: 'bg-mint text-meadow',
  },
  {
    icon: <Heart className="h-5 w-5" />,
    title: 'Match with confidence',
    copy: 'Check ratings, delivery options, portions, and chef style before you commit to a meal.',
    tone: 'bg-blush text-pepper',
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: 'Chat and customize',
    copy: 'Ask for more spice, fewer onions, larger trays, or a pickup time that works for your evening.',
    tone: 'bg-lilac text-ink',
  },
  {
    icon: <ChefHat className="h-5 w-5" />,
    title: 'Come back for favorites',
    copy: 'Keep your best chefs close and re-order the meals that already feel like home.',
    tone: 'bg-butter text-ink',
  },
]

export function LandingHow() {
  return (
    <section
      id="how"
      className="relative overflow-hidden bg-gradient-to-b from-cream via-surface-muted/30 to-cream px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto mb-12 max-w-3xl text-center"
        >
          <Badge
            variant="lime"
            size="md"
            className="mb-4 border-sage/80 bg-mint text-meadow"
          >
            How it works
          </Badge>
          <h2
            data-gsap="heading-reveal"
            className="text-balance font-heading text-display-lg text-ink"
          >
            Swipe through real home chefs. Chat directly. Book a meal.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-body leading-8 sm:text-lg">
            Every chef profile shows their specialties, prices, location, and
            ratings from real buyers. Nothing generic, nothing guessed.
          </p>
        </motion.div>

        <div className="space-y-4 overflow-hidden">
          <div className="landing-marquee landing-marquee-left">
            {[...DISCOVERY_RAIL, ...DISCOVERY_RAIL].map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className={`flex min-w-[18rem] max-w-[18rem] flex-col gap-2 rounded-[2rem] border border-white/75 ${item.tone} p-5 shadow-card sm:min-w-[20rem] sm:max-w-[20rem]`}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  curated
                </p>
                <h3 className="font-heading text-2xl font-bold text-ink">
                  {item.title}
                </h3>
                <p className="text-body text-sm leading-6">{item.copy}</p>
              </div>
            ))}
          </div>

          <div className="landing-marquee landing-marquee-right">
            {[...DISCOVERY_RAIL_ALT, ...DISCOVERY_RAIL_ALT].map(
              (item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className={`flex min-w-[16rem] max-w-[16rem] items-end justify-between rounded-[2rem] border border-white/75 ${item.tone} p-5 shadow-card sm:min-w-[18rem] sm:max-w-[18rem]`}
                >
                  <div>
                    <h3 className="font-heading text-xl font-bold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-body text-sm leading-6">
                      {item.copy}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-body text-xs font-semibold">
                    Food4Love
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div
          className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"
          data-gsap="card-group"
        >
          {STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.08 }}
            >
              <Card
                data-gsap="micro-card"
                className="h-full rounded-[2rem] p-6"
              >
                <div
                  className={`inline-flex rounded-2xl px-3 py-3 ${step.tone}`}
                >
                  {step.icon}
                </div>
                <h3 className="mt-5 font-heading text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-body text-sm leading-7">{step.copy}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
