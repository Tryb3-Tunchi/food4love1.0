'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import imageCompression from 'browser-image-compression'
import toast from 'react-hot-toast'
import { Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createDailySpecial,
  updateDailySpecial,
} from '@/services/dailySpecials'
import { Button } from '@/components/ui/Button'
import type { DailySpecial } from '@/types/db'

const FULFILLMENT_CHOICES = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
]

const ALLERGEN_CHOICES = [
  'Gluten',
  'Dairy',
  'Eggs',
  'Peanuts',
  'Tree nuts',
  'Fish',
  'Shellfish',
  'Soy',
  'Sesame',
]

const INPUT =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]'

function toLocalInput(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function defaultAvailableUntil() {
  return toLocalInput(new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())
}

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
      {children}
    </label>
  )
}

interface DishFormSheetProps {
  open: boolean
  cookId: string
  editing: DailySpecial | null
  onClose: () => void
  onSaved: () => void
}

export function DishFormSheet({
  open,
  cookId,
  editing,
  onClose,
  onSaved,
}: DishFormSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [availableUntil, setAvailableUntil] = useState(defaultAvailableUntil())
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [servingSize, setServingSize] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [fulfillment, setFulfillment] = useState<string[]>([])
  const [fulfillmentNotes, setFulfillmentNotes] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [allergens, setAllergens] = useState<string[]>([])
  const [portions, setPortions] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(editing?.title ?? '')
    setDescription(editing?.description ?? '')
    setPrice(editing ? String(editing.price) : '')
    setAvailableUntil(
      editing ? toLocalInput(editing.available_until) : defaultAvailableUntil(),
    )
    setImageUrl(editing?.image_url ?? null)
    setServingSize(editing?.serving_size ? String(editing.serving_size) : '')
    setLeadTime(editing?.lead_time_hours ? String(editing.lead_time_hours) : '')
    setFulfillment(editing?.fulfillment_options ?? [])
    setFulfillmentNotes(editing?.fulfillment_notes ?? '')
    setIngredients(editing?.ingredients ?? '')
    setAllergens(editing?.allergens ?? [])
    setPortions(
      editing?.portions_available != null
        ? String(editing.portions_available)
        : '',
    )
  }, [open, editing])

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
      })
      const path = `${cookId}/${Date.now()}-${file.name}`
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
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !price) {
      toast.error('Add a dish name and price')
      return
    }

    const extras = {
      serving_size: servingSize ? Number(servingSize) : null,
      lead_time_hours: leadTime ? Number(leadTime) : null,
      fulfillment_options: fulfillment.length ? fulfillment : null,
      fulfillment_notes: fulfillmentNotes.trim() || null,
      ingredients: ingredients.trim() || null,
      allergens: allergens.length ? allergens : null,
      portions_available: portions ? Number(portions) : null,
    }
    const hasExtras = Object.values(extras).some((v) => v !== null)

    setSaving(true)
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
        toast.success('Dish updated')
      } else {
        await createDailySpecial({
          cook_id: cookId,
          title: title.trim(),
          description: description.trim() || undefined,
          price: Number(price),
          image_url: imageUrl ?? undefined,
          available_until: new Date(availableUntil).toISOString(),
          ...(hasExtras ? extras : {}),
        })
        toast.success('Dish posted!')
      }
      onSaved()
    } catch {
      toast.error(editing ? 'Failed to update dish' : 'Failed to post dish')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit dish' : 'Add a dish'}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--bg)] p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="font-heading text-xl font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                {editing ? 'Edit dish' : 'Add a dish'}
              </h2>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-2)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
            {imageUrl ? (
              <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-2xl">
                <img
                  src={imageUrl}
                  alt="Your dish"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mb-4 flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
                style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm font-semibold">
                  {uploading ? 'Uploading…' : 'Add a photo of your dish'}
                </span>
                <span className="text-xs">Great photos get more orders</span>
              </button>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Dish name</Label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Jollof rice & grilled chicken"
                  className={INPUT}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What makes today's batch special?"
                  className={`${INPUT} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price (₦)</Label>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2500"
                    className={INPUT}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Available until</Label>
                  <input
                    type="datetime-local"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                    className={INPUT}
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
                    fulfillmentNotes ||
                    ingredients ||
                    allergens.length ||
                    portions
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
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Serves</Label>
                      <input
                        type="number"
                        min={1}
                        value={servingSize}
                        onChange={(e) => setServingSize(e.target.value)}
                        placeholder="4"
                        className={INPUT}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Portions left</Label>
                      <input
                        type="number"
                        min={0}
                        value={portions}
                        onChange={(e) => setPortions(e.target.value)}
                        placeholder="10"
                        className={INPUT}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notice (hrs)</Label>
                      <input
                        type="number"
                        min={0}
                        value={leadTime}
                        onChange={(e) => setLeadTime(e.target.value)}
                        placeholder="24"
                        className={INPUT}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Ingredients</Label>
                    <textarea
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                      rows={2}
                      placeholder="Rice, tomatoes, peppers, onions, chicken, spices"
                      className={`${INPUT} resize-none`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Contains (allergens)</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGEN_CHOICES.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setAllergens(toggle(allergens, name))}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            allergens.includes(name)
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-2)] text-[var(--text-2)]'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>How buyers get it</Label>
                    <div className="flex gap-2">
                      {FULFILLMENT_CHOICES.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          onClick={() =>
                            setFulfillment(toggle(fulfillment, choice.value))
                          }
                          className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
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
                      className={INPUT}
                    />
                  </div>
                </div>
              </details>

              <Button
                size="lg"
                className="w-full bg-[var(--accent)]"
                loading={saving}
                onClick={handleSave}
              >
                {editing ? 'Save changes' : 'Post dish'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
