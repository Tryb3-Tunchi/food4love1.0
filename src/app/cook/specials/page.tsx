'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Upload, X, Trash2, UtensilsCrossed } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getDailySpecialsByCook,
  createDailySpecial,
  deleteDailySpecial,
} from '@/services/dailySpecials'
import { formatNaira } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

function defaultAvailableUntil() {
  const d = new Date()
  d.setHours(d.getHours() + 6)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function CookSpecialsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login')
  }, [authLoading, profile, router])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [availableUntil, setAvailableUntil] = useState(defaultAvailableUntil())
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: specials = [], isLoading } = useQuery({
    queryKey: ['daily-specials', profile?.id],
    queryFn: () => getDailySpecialsByCook(profile!.id),
    enabled: !!profile?.id,
  })

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file || !profile) return
      setUploadingPhoto(true)
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
        })
        const path = `${profile.id}/${Date.now()}-${file.name}`
        const sb = createClient()
        const { error } = await sb.storage
          .from('profile-photos')
          .upload(path, compressed)
        if (error) throw error
        const { data } = sb.storage.from('profile-photos').getPublicUrl(path)
        setImageUrl(data.publicUrl)
      } catch {
        toast.error('Could not upload photo')
      } finally {
        setUploadingPhoto(false)
      }
    },
    [profile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPrice('')
    setAvailableUntil(defaultAvailableUntil())
    setImageUrl(null)
  }

  const handleSubmit = async () => {
    if (!profile) return
    if (!title.trim() || !price) {
      toast.error('Add a dish name and price')
      return
    }
    setSubmitting(true)
    try {
      await createDailySpecial({
        cook_id: profile.id,
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        image_url: imageUrl ?? undefined,
        available_until: new Date(availableUntil).toISOString(),
      })
      toast.success('Special posted!')
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['daily-specials'] })
    } catch {
      toast.error('Failed to post special')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDailySpecial(id)
      toast.success('Special removed')
      queryClient.invalidateQueries({ queryKey: ['daily-specials'] })
    } catch {
      toast.error('Failed to remove special')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Manage specials
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Post today's dish, price, and when it's available until.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 p-4"
      >
        <div className="f4l-card space-y-4 p-4">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--text-1)' }}
            >
              Dish name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Jollof rice & grilled chicken"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--text-1)' }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What makes today's batch special?"
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--text-1)' }}
              >
                Price (₦)
              </label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2500"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--text-1)' }}
              >
                Available until
              </label>
              <input
                type="datetime-local"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--text-1)' }}
            >
              Photo (optional)
            </label>
            {imageUrl ? (
              <div className="relative h-32 w-32 overflow-hidden rounded-xl">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${
                  isDragActive
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border)] hover:border-[var(--text-3)]'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--text-3)]" />
                <p className="text-xs text-[var(--text-3)]">
                  {uploadingPhoto
                    ? 'Uploading...'
                    : isDragActive
                      ? 'Drop the photo here'
                      : 'Tap to add a photo'}
                </p>
              </div>
            )}
          </div>

          <Button
            size="lg"
            className="w-full bg-[var(--accent)]"
            loading={submitting}
            onClick={handleSubmit}
          >
            Post special
          </Button>
        </div>

        <div>
          <p className="f4l-section-label mb-3">Your active specials</p>
          {isLoading ? (
            <p className="text-sm text-[var(--text-3)]">Loading...</p>
          ) : specials.length === 0 ? (
            <div className="f4l-card flex flex-col items-center gap-2 p-6 text-center">
              <UtensilsCrossed className="h-8 w-8 text-[var(--text-3)]" />
              <p className="text-sm text-[var(--text-3)]">
                No specials posted yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {specials.map((s) => (
                <div
                  key={s.id}
                  className="f4l-card flex items-center gap-3 p-3"
                >
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-2)] text-2xl">
                      🍽️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {s.title}
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      {formatNaira(s.price)}
                    </p>
                    <p className="text-xs text-[var(--text-3)]">
                      Until{' '}
                      {new Date(s.available_until).toLocaleTimeString('en-NG', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Delete special"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
