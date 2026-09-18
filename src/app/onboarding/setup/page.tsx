'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, ProfileInput } from '@/lib/validations'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { MapPin, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CUISINE_CATEGORIES, CUISINE_SELECTION_LIMIT } from '@/lib/cuisines'

export default function SetupPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const [selected, setSelected] = useState<string[]>([])
  const [generatingBio, setGeneratingBio] = useState(false)
  const [cuisineSearch, setCuisineSearch] = useState('')
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '' },
  })

  useEffect(() => {
    if (profile?.full_name) setValue('full_name', profile.full_name)
  }, [profile?.full_name, setValue])

  const toggleCuisine = (c: string) => {
    if (!selected.includes(c) && selected.length >= CUISINE_SELECTION_LIMIT) {
      toast.error(`You can only pick up to ${CUISINE_SELECTION_LIMIT}`)
      return
    }
    const next = selected.includes(c)
      ? selected.filter((x) => x !== c)
      : [...selected, c]
    setSelected(next)
    setValue('cuisines', next)
  }

  const filteredCategories = useMemo(() => {
    const q = cuisineSearch.trim().toLowerCase()
    if (!q) return CUISINE_CATEGORIES
    return CUISINE_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.toLowerCase().includes(q)),
    })).filter((cat) => cat.items.length > 0)
  }, [cuisineSearch])

  const generateBio = async () => {
    if (!profile) return
    setGeneratingBio(true)
    try {
      const res = await fetch('/api/ai/bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.full_name,
          cuisines: selected.join(', '),
          location: watch('location'),
          specialty: selected[0],
        }),
      })
      const { bio } = await res.json()
      if (bio) setValue('bio', bio)
    } finally {
      setGeneratingBio(false)
    }
  }

  const onSubmit = async (data: ProfileInput) => {
    if (!profile) return
    try {
      const updated = await updateProfile(profile.id, {
        ...data,
        cuisines: selected,
        onboarding_complete: true,
      })
      updateStore(updated)
      toast.success('Profile saved!')
      router.push('/swipe')
    } catch {
      toast.error('Failed to save profile')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-sm"
      >
        <div className="mb-8">
          <div className="mb-6 flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${s <= 2 ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
              />
            ))}
          </div>
          <h1 className="mb-1 text-2xl font-bold text-[var(--text-1)]">
            Set up your profile
          </h1>
          <p className="text-sm text-[var(--text-3)]">
            Step 2 of 3 — Almost there!
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Your location"
            placeholder="Lekki, Lagos"
            leftIcon={<MapPin className="h-4 w-4" />}
            error={errors.location?.message}
            {...register('location')}
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-1)]">
                Your specialties
              </label>
              <span className="text-xs text-[var(--text-3)]">
                {selected.length}/{CUISINE_SELECTION_LIMIT} selected
              </span>
            </div>

            {selected.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selected.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCuisine(c)}
                    className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-warm)]"
                  >
                    {c} ✕
                  </button>
                ))}
              </div>
            )}

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                value={cuisineSearch}
                onChange={(e) => setCuisineSearch(e.target.value)}
                placeholder="Search dishes — jollof, suya, egusi..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-3">
              {filteredCategories.map((cat) => (
                <details key={cat.category} open={!!cuisineSearch}>
                  <summary className="cursor-pointer py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    {cat.category}
                  </summary>
                  <div className="mb-2 mt-2 flex flex-wrap gap-2">
                    {cat.items.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCuisine(c)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${selected.includes(c) ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-warm)]' : 'bg-[var(--card)] text-[var(--text-2)] hover:bg-[var(--divider)]'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--text-1)]">
                Bio
              </label>
              <button
                type="button"
                onClick={generateBio}
                disabled={generatingBio || selected.length === 0}
                className="flex items-center gap-1 text-xs text-[color:var(--accent)] transition-all hover:text-[color:var(--accent-strong)] disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generatingBio ? 'Generating...' : 'AI Write for me'}
              </button>
            </div>
            <textarea
              {...register('bio')}
              rows={3}
              placeholder="Tell food lovers about your cooking..."
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isSubmitting}
          >
            Continue →
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
