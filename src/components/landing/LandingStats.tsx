'use client'

import { motion } from 'framer-motion'
import { Clock3, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

const TRUST_CARDS = [
  {
    value: '2,400+',
    label: 'verified chefs',
    copy: 'A growing network of real home cooks across key cities.',
    tone: 'bg-mint',
    icon: <ShieldCheck className="h-5 w-5" />,
    iconTone: 'bg-white/85 text-meadow',
  },
  {
    value: '4.9/5',
    label: 'average ratings',
    copy: 'Cleaner trust signals and better food-first storytelling.',
    tone: 'bg-blush',
    icon: <Sparkles className="h-5 w-5" />,
    iconTone: 'bg-white/85 text-pepper',
  },
  {
    value: '24 min',
    label: 'typical pickup window',
    copy: 'The product now communicates speed without feeling rushed or loud.',
    tone: 'bg-butter',
    icon: <Clock3 className="h-5 w-5" />,
    iconTone: 'bg-white/85 text-ink',
  },
  {
    value: '1:1',
    label: 'chef conversation',
    copy: 'Talk directly with the person cooking your food before you order.',
    tone: 'bg-lilac',
    icon: <HeartHandshake className="h-5 w-5" />,
    iconTone: 'bg-white/85 text-ink',
  },
]

export function LandingStats() {
  return (
    <section className="bg-cream px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
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
            className="mb-4 border-sage/80 bg-sage text-meadow"
          >
            Why this feels better
          </Badge>
          <h2
            data-gsap="heading-reveal"
            className="text-balance font-heading text-display-lg text-ink"
          >
            Softer contrast, better hierarchy, and more movement across the
            whole page.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-body leading-8 sm:text-lg">
            This section replaces the heavy dark stats block with a lighter
            trust story, still informative, but much more aligned with the
            friendly brand you described.
          </p>
        </motion.div>

        <div
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"
          data-gsap="card-group"
        >
          {TRUST_CARDS.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.08 }}
            >
              <Card
                data-gsap="micro-card"
                className={`h-full rounded-[2rem] ${card.tone} p-6`}
              >
                <div className={`inline-flex rounded-2xl p-3 ${card.iconTone}`}>
                  {card.icon}
                </div>
                <div className="mt-6 font-heading text-4xl font-extrabold tracking-[-0.04em] text-ink">
                  {card.value}
                </div>
                <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  {card.label}
                </div>
                <p className="mt-4 text-body text-sm leading-7">{card.copy}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
