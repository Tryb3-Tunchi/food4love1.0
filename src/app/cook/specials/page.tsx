'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Clock,
  Pause,
  Pencil,
  Play,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getDailySpecialsByCook,
  createDailySpecial,
  updateDailySpecial,
  deleteDailySpecial,
} from '@/services/dailySpecials'
import { formatNaira } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { DailySpecial } from '@/types/db'

const FULFILLMENT_CHOICES = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
]

function toLocalInput(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function defaultAvailableUntil() {
  return toLocalInput(new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())
}

export default function CookSpecialsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login')
  }, [authLoading, profile, router])

  const [editing, setEditing] = useState<DailySpecial | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [availableUntil, setAvailableUntil] = useState(defaultAvailableUntil())
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [servingSize, setServingSize] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [fulfillment, setFulfillment] = useState<string[]>([])
  const [fulfillmentNotes, setFulfillmentNotes] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: specials = [], isLoading } = useQuery<DailySpecial[]>({
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
    setEditing(null)
    setTitle('')
    setDescription('')
    setPrice('')
    setAvailableUntil(defaultAvailableUntil())
    setImageUrl(null)
    setServingSize('')
    setLeadTime('')
    setFulfillment([])
    setFulfillmentNotes('')
  }

  const startEditing = (special: DailySpecial) => {
    setEditing(special)
    setTitle(special.title)
    setDescription(special.description ?? '')
    setPrice(String(special.price))
    setAvailableUntil(toLocalInput(special.available_until))
    setImageUrl(special.image_url ?? null)
    setServingSize(special.serving_size ? String(special.serving_size) : '')
    setLeadTime(special.lead_time_hours ? String(special.lead_time_hours) : '')
    setFulfillment(special.fulfillment_options ?? [])
    setFulfillmentNotes(special.fulfillment_notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleFulfillment = (value: string) =>
    setFulfillment((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    )

  const handleSubmit = async () => {
    if (!profile) return
    if (!title.trim() || !price) {
      toast.error('Add a dish name and price')
      return
    }

    const extras = {
      serving_size: servingSize ? Number(servingSize) : null,
      lead_time_hours: leadTime ? Number(leadTime) : null,
      fulfillment_options: fulfillment.length ? fulfillment : null,
      fulfillment_notes: fulfillmentNotes.trim() || null,
    }
    const hasExtras = Object.values(extras).some((v) => v !== null)

    setSubmitting(true)
    try {
      if (editing) {
        await updateDailySpecial(editing.id, {
          title: title.trim(),
          description: description.trim() || null,
          price: Number(price),
          image_url: imageUrl,
          available_until: new Date(availableUntil).toISOString(),
          ...(hasExtras || 'is_paused' in editing ? extras : {}),
        })
        toast.success('Special updated')
      } else {
        await createDailySpecial({
          cook_id: profile.id,
          title: title.trim(),
          description: description.trim() || undefined,
          price: Number(price),
          image_url: imageUrl ?? undefined,
          available_until: new Date(availableUntil).toISOString(),
          ...(hasExtras ? extras : {}),
        })
        toast.success('Special posted!')
      }
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['daily-specials'] })
    } catch {
      toast.error(
        editing ? 'Failed to update special' : 'Failed to post special',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePause = async (special: DailySpecial) => {
    try {
      await updateDailySpecial(special.id, { is_paused: !special.is_paused })
      toast.success(
        special.is_paused ? 'Special is live again' : 'Special paused',
      )
      queryClient.invalidateQueries({ queryKey: ['daily-specials'] })
    } catch {
      toast.error('Could not update special')
    }
  }

  const handleEndNow = async (special: DailySpecial) => {
    try {
      await updateDailySpecial(special.id, {
        available_until: new Date().toISOString(),
      })
      toast.success('Special ended')
      queryClient.invalidateQueries({ queryKey: ['daily-specials'] })
    } catch {
      toast.error('Could not end special')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDailySpecial(id)
      toast.success('Special removed')
      if (editing?.id === id) resetForm()
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
          Post, edit, pause or end your meal listings.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 p-4"
      >
        <div className="f4l-card space-y-4 p-4">
          {editing && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)] px-3 py-2">
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                Editing “{editing.title}”
              </p>
              <button
                onClick={resetForm}
                className="text-xs font-bold"
                style={{ color: 'var(--text-3)' }}
              >
                Cancel
              </button>
            </div>
          )}

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

          <details
            className="rounded-xl border border-[var(--border)] px-3.5 py-2.5"
            open={
              !!(
                servingSize ||
                leadTime ||
                fulfillment.length ||
                fulfillmentNotes
              )
            }
          >
            <summary
              className="cursor-pointer text-sm font-medium"
              style={{ color: 'var(--text-1)' }}
            >
              More details (optional)
            </summary>
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-1)' }}
                  >
                    Serves
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={servingSize}
                    onChange={(e) => setServingSize(e.target.value)}
                    placeholder="4 people"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-1)' }}
                  >
                    Notice needed (hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    placeholder="24"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-1)' }}
                >
                  How buyers get it
                </label>
                <div className="flex gap-2">
                  {FULFILLMENT_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => toggleFulfillment(choice.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                        fulfillment.includes(choice.value)
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-2)] text-[var(--text-2)]'
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
                <input
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  placeholder="Pickup from Lekki Phase 1, delivery within Lagos Island"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </details>

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
            {editing ? 'Save changes' : 'Post special'}
          </Button>
        </div>

        <div>
          <p className="f4l-section-label mb-3">Your specials</p>
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
                  className={`f4l-card p-3 ${s.is_paused ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-2">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--text-1)' }}
                        >
                          {s.title}
                        </p>
                        {s.is_paused && (
                          <span className="f4l-badge f4l-badge-warning">
                            Paused
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        {formatNaira(s.price)}
                      </p>
                      <p className="text-xs text-[var(--text-3)]">
                        Until{' '}
                        {new Date(s.available_until).toLocaleString('en-NG', {
                          weekday: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {s.serving_size ? ` · Serves ${s.serving_size}` : ''}
                        {s.lead_time_hours
                          ? ` · ${s.lead_time_hours}h notice`
                          : ''}
                        {s.fulfillment_options?.length
                          ? ` · ${s.fulfillment_options.join(' / ')}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--divider)] pt-3">
                    <button
                      onClick={() => startEditing(s)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePause(s)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)]"
                    >
                      {s.is_paused ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                      {s.is_paused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={() => handleEndNow(s)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)]"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      End now
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-3)] hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Delete special"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
