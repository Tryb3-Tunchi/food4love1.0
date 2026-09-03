'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Check,
  ChefHat,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from 'lucide-react'
import { signupSchema, SignupInput } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const PERKS = [
  'Role-based experience from day one',
  'Direct chef and buyer conversations',
  'Cleaner discovery, booking, and trust cues',
  'Same product language with different lead colors',
]

function SignupPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const role = params.get('role') === 'cook' ? 'cook' : 'buyer'
  const isCook = role === 'cook'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  const onSubmit = async (data: SignupInput) => {
    const sb = createClient()
    const loadingToast = toast.loading('Creating your account...')
    const { error } = await sb.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.full_name, phone: data.phone, role } },
    })
    toast.dismiss(loadingToast)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Account created. Check your email.')
    router.push('/verify')
  }

  return (
    <div
      className={`${isCook ? 'theme-cook' : 'theme-buyer'} f4l-auth-grid px-4 py-6 sm:px-6 lg:px-8`}
    >
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-7xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="f4l-auth-spotlight hidden rounded-[2.75rem] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-2 backdrop-blur-sm"
            >
              <div className="bg-white/18 flex h-10 w-10 items-center justify-center rounded-full">
                <ChefHat className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading text-xl font-extrabold tracking-tight">
                Food4Love
              </span>
            </Link>

            <div className="bg-white/12 mt-10 inline-flex rounded-full px-4 py-2 text-sm font-semibold">
              {isCook ? 'Cook experience' : 'Buyer experience'}
            </div>
            <h1 className="mt-6 max-w-md font-heading text-5xl font-bold leading-[1.02] tracking-[-0.05em]">
              {isCook
                ? 'Turn your kitchen into a premium, trusted storefront.'
                : 'Find the chefs who make dinner feel personal again.'}
            </h1>
            <p className="text-white/76 mt-5 max-w-md text-base leading-8">
              {isCook
                ? 'Set pricing, availability, specialties, and let the app carry a stronger warm tone for your side of the marketplace.'
                : 'Browse a greener, softer buyer flow built around discovery, comfort, and quick decisions without clutter.'}
            </p>

            <div className="mt-8 space-y-3">
              {PERKS.map((perk) => (
                <div
                  key={perk}
                  className="flex items-start gap-3 rounded-[1.4rem] bg-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="bg-white/18 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full">
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-white/80">{perk}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-white/14 relative z-10 rounded-[2rem] border bg-white/10 p-5 backdrop-blur-md">
            <p className="text-sm font-semibold">
              Same system, different lead color
            </p>
            <p className="text-white/74 mt-2 text-sm leading-7">
              Buyers lean softer and greener. Cooks stay warmer and bolder. The
              structure, spacing, and motion language still belong to one
              product.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="f4l-auth-panel w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 lg:p-10"
          >
            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-3 rounded-full bg-white/80 px-3 py-2 lg:hidden"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${isCook ? 'bg-blush text-pepper' : 'bg-mint text-meadow'}`}
              >
                <ChefHat className="h-5 w-5" />
              </div>
              <span className="font-heading text-xl font-extrabold tracking-tight text-ink">
                Food4Love
              </span>
            </Link>

            <div className="mb-8">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isCook ? 'bg-blush text-pepper' : 'bg-mint text-meadow'}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isCook ? 'Signing up as a cook' : 'Signing up as a food lover'}
              </div>
              <h2 className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink">
                Create your account
              </h2>
              <p className="mt-3 text-body text-sm leading-7">
                Already have one?{' '}
                <Link
                  href={isCook ? '/login/cook' : '/login'}
                  className="font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <Input
                label="Full name"
                placeholder="Adaeze Okonkwo"
                leftIcon={<User className="h-4 w-4" />}
                error={errors.full_name?.message}
                {...register('full_name')}
              />
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Phone number"
                placeholder="+234 801 234 5678"
                leftIcon={<Phone className="h-4 w-4" />}
                error={errors.phone?.message}
                hint="Used for booking and match notifications"
                {...register('phone')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Create a strong password"
                leftIcon={<Lock className="h-4 w-4" />}
                error={errors.password?.message}
                hint="Minimum 6 characters"
                {...register('password')}
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={isSubmitting}
                rightIcon={
                  !isSubmitting ? <ArrowRight className="h-4 w-4" /> : undefined
                }
                className="mt-2"
              >
                Create account
              </Button>
            </form>

            <div className="mt-5 text-center">
              <p className="mb-2 text-xs text-muted">
                {isCook
                  ? 'Want to find food instead?'
                  : 'Want to cook and earn?'}
              </p>
              <Link
                href={isCook ? '/signup' : '/signup?role=cook'}
                className="text-xs font-semibold text-[color:var(--accent)] hover:underline"
              >
                {isCook ? 'Sign up as a food lover' : 'Sign up as a chef'} →
              </Link>
            </div>

            <p className="mt-6 text-center text-xs text-muted">
              By creating an account you agree to our{' '}
              <Link href="#" className="underline hover:text-ink">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="#" className="underline hover:text-ink">
                Privacy Policy
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-buyer f4l-auth-grid flex min-h-screen items-center justify-center">
          <div className="text-body text-sm font-medium">Loading...</div>
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  )
}
