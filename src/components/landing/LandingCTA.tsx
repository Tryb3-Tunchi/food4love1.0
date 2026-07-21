'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, ChefHat, Heart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function LandingCTA() {
  return (
    <section
      id="join"
      className="bg-cream px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div
        className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.9fr_1.1fr]"
        data-gsap="card-group"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <Card
            data-gsap="micro-card"
            className="h-full rounded-[2.5rem] bg-mint p-8 sm:p-10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-white/80 text-meadow shadow-sm">
              <ChefHat className="h-6 w-6" />
            </div>
            <h2
              data-gsap="heading-reveal"
              className="mt-6 font-heading text-3xl font-bold leading-tight text-ink sm:text-4xl"
            >
              Turn your kitchen into a consistent income.
            </h2>
            <p className="mt-4 text-base text-body leading-8">
              Set your own hours, choose your specials, and build a local
              following around the meals you love making.
            </p>
            <div className="mt-8 rounded-[1.8rem] bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold text-ink">For cooks</p>
              <p className="mt-2 text-body text-sm leading-7">
                Set availability, show specialties, get discovered locally, and
                build repeat customers around meals you actually love making.
              </p>
              <Link href="/signup?role=cook" className="mt-5 inline-flex">
                <Button
                  size="lg"
                  pill
                  className="bg-meadow text-white hover:bg-herb"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Become a chef
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ delay: 0.08 }}
          data-gsap="micro-card"
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-meadow via-herb to-leaf p-8 text-white shadow-float sm:p-10 md:p-12"
        >
          <div className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-0 h-60 w-60 rounded-full bg-ember/15 blur-3xl" />

          <div className="relative z-10">
            <div className="bg-white/12 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
              <Heart className="h-4 w-4" />
              For food lovers
            </div>
            <h2
              data-gsap="heading-reveal"
              className="mt-6 max-w-xl font-heading text-4xl font-bold leading-tight sm:text-5xl"
            >
              Ready to match with a home chef who feels like your favorite
              secret?
            </h2>
            <p className="text-white/78 mt-5 max-w-lg text-base leading-8 sm:text-lg">
              Browse chefs nearby, match with the ones that feel right, and
              build a relationship with the food that feeds you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup">
                <Button
                  size="xl"
                  pill
                  className="bg-white text-meadow shadow-none hover:bg-cream"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Get started free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="xl"
                  pill
                  className="border-white/25 text-white hover:border-white/35 hover:bg-white/10"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
