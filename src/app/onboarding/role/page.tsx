'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChefHat, Sparkles, UtensilsCrossed } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'

const ROLE_OPTIONS = [
  {
    role: 'buyer' as const,
    title: 'Food Lover',
    desc: 'Discover nearby home chefs, save favorites, and book meals with a softer, buyer-led flow.',
    theme: 'theme-buyer',
    iconWrap: 'bg-mint text-meadow',
    border: 'hover:border-meadow/35',
    icon: <UtensilsCrossed className="h-6 w-6" />,
  },
  {
    role: 'cook' as const,
    title: 'Home Chef',
    desc: 'Show your menu, manage demand, and grow with a warmer, stronger cook-led experience.',
    theme: 'theme-cook',
    iconWrap: 'bg-blush text-pepper',
    border: 'hover:border-pepper/35',
    icon: <ChefHat className="h-6 w-6" />,
  },
]

export default function RoleSelectPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)

  const selectRole = async (role: 'cook' | 'buyer') => {
    if (!profile) return
    await updateProfile(profile.id, { role })
    updateStore({ role })
    router.push('/onboarding/setup')
  }

  return (
    <div className="theme-buyer f4l-auth-grid flex min-h-screen items-center justify-center px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="f4l-auth-panel w-full max-w-4xl rounded-[2.75rem] p-8 sm:p-10"
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 flex gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full ${step === 1 ? 'bg-meadow' : 'bg-border'}`}
              />
            ))}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-meadow">
            <Sparkles className="h-3.5 w-3.5" />
            Step 1 of 3
          </div>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink sm:text-5xl">
            Choose your main experience
          </h1>
          <p className="mt-4 text-body text-sm leading-7 sm:text-base">
            The pattern stays the same across Food4Love, but your lead colors
            and emphasis change depending on whether you are here to discover
            meals or cook professionally.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {ROLE_OPTIONS.map((option, index) => (
            <motion.button
              key={option.role}
              type="button"
              onClick={() => selectRole(option.role)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              className={`f4l-card ${option.theme} flex flex-col items-start rounded-[2rem] border p-7 text-left transition-all ${option.border}`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] ${option.iconWrap}`}
              >
                {option.icon}
              </div>
              <h2 className="mt-6 font-heading text-3xl font-bold text-ink">
                {option.title}
              </h2>
              <p className="mt-3 text-body text-sm leading-7">{option.desc}</p>
              <span className="mt-6 inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[color:var(--accent)]">
                Continue as {option.title}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
