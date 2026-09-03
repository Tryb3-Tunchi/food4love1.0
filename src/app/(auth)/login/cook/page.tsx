'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  ChefHat,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { loginSchema, LoginInput } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'
import { getPostLoginRedirect } from '@/lib/auth/postLoginRedirect'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const LOGIN_CARDS = [
  {
    title: 'Incoming requests',
    copy: 'See who wants to book you.',
    tone: 'bg-blush text-pepper',
  },
  {
    title: 'Daily specials',
    copy: 'Post what you are cooking today.',
    tone: 'bg-butter text-ink',
  },
  {
    title: 'Verified badge',
    copy: 'Trust built into your storefront.',
    tone: 'bg-lilac text-ink',
  },
]

export default function CookLoginPage() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginInput) => {
    const sb = createClient()
    const loadingToast = toast.loading('Signing you in...')
    const { data: authData, error } = await sb.auth.signInWithPassword(data)
    toast.dismiss(loadingToast)
    if (error || !authData.user) {
      toast.error('Incorrect email or password. Try again.')
      return
    }
    toast.success('Welcome back, chef.')
    router.push(await getPostLoginRedirect(sb, authData.user.id))
  }

  return (
    <div className="theme-cook f4l-auth-grid px-4 py-6 sm:px-6 lg:px-8">
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

            <h1 className="mt-10 max-w-md font-heading text-5xl font-bold leading-[1.02] tracking-[-0.05em]">
              Your kitchen, your storefront, your requests.
            </h1>
            <p className="text-white/76 mt-5 max-w-md text-base leading-8">
              Sign in to manage your specials, review match requests, and keep
              your storefront warm and ready.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="landing-marquee landing-marquee-left">
              {[...LOGIN_CARDS, ...LOGIN_CARDS].map((card, index) => (
                <div
                  key={`${card.title}-${index}`}
                  className={`min-w-[14rem] rounded-[1.8rem] ${card.tone} px-5 py-4 shadow-card`}
                >
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-2 text-sm opacity-80">{card.copy}</p>
                </div>
              ))}
            </div>

            <div className="border-white/14 rounded-[2rem] border bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="bg-white/16 flex h-11 w-11 items-center justify-center rounded-2xl">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Cook-led color system</p>
                  <p className="text-white/74 mt-2 text-sm leading-7">
                    The app keeps one pattern language, but cooks stay warmer
                    and bolder while buyers lean greener and softer.
                  </p>
                </div>
              </div>
            </div>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-pepper">
                <ChefHat className="h-5 w-5" />
              </div>
              <span className="font-heading text-xl font-extrabold tracking-tight text-ink">
                Food4Love
              </span>
            </Link>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-pepper">
                <Sparkles className="h-3.5 w-3.5" />
                Welcome back, chef
              </div>
              <h2 className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink">
                Sign in to your chef account
              </h2>
              <p className="mt-3 text-body text-sm leading-7">
                No account yet?{' '}
                <Link
                  href="/signup?role=cook"
                  className="font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Create one here
                </Link>
              </p>
              <p className="mt-1 text-body text-sm leading-7">
                Want to find a chef instead?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Find a chef
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
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
                Sign in
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-6">
              <p className="text-center text-xs text-muted">
                By signing in you agree to our{' '}
                <Link href="#" className="underline hover:text-ink">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="#" className="underline hover:text-ink">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
