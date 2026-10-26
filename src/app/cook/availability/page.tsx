'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getCookAvailability,
  saveCookAvailability,
} from '@/services/availability'
import { WEEKDAYS } from '@/lib/availability'
import { Button } from '@/components/ui/Button'
import type { WeekdayKey } from '@/types/db'

interface DayState {
  on: boolean
  open: string
  close: string
}

type WeekState = Record<WeekdayKey, DayState>

const DEFAULT_WEEK: WeekState = {
  mon: { on: true, open: '09:00', close: '18:00' },
  tue: { on: true, open: '09:00', close: '18:00' },
  wed: { on: true, open: '09:00', close: '18:00' },
  thu: { on: true, open: '09:00', close: '18:00' },
  fri: { on: true, open: '09:00', close: '18:00' },
  sat: { on: true, open: '09:00', close: '18:00' },
  sun: { on: false, open: '09:00', close: '18:00' },
}

export default function CookAvailabilityPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login')
  }, [authLoading, profile, router])

  const [limitHours, setLimitHours] = useState(true)
  const [week, setWeek] = useState<WeekState>(DEFAULT_WEEK)
  const [maxOrders, setMaxOrders] = useState('')
  const [noticeHours, setNoticeHours] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [areaInput, setAreaInput] = useState('')
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: saved, isLoading } = useQuery({
    queryKey: ['cook-availability', profile?.id],
    queryFn: () => getCookAvailability(profile!.id),
    enabled: !!profile?.id,
  })

  useEffect(() => {
    if (isLoading || loaded) return
    if (saved) {
      const hasSchedule = Object.keys(saved.weekly_hours ?? {}).length > 0
      setLimitHours(hasSchedule)
      if (hasSchedule) {
        setWeek(
          WEEKDAYS.reduce((acc, { key }) => {
            const hours = saved.weekly_hours[key]
            acc[key] = hours
              ? { on: true, open: hours.open, close: hours.close }
              : { ...DEFAULT_WEEK[key], on: false }
            return acc
          }, {} as WeekState),
        )
      }
      setMaxOrders(
        saved.max_orders_per_day ? String(saved.max_orders_per_day) : '',
      )
      setNoticeHours(saved.notice_hours ? String(saved.notice_hours) : '')
      setAreas(saved.service_areas ?? [])
      setPaused(saved.is_paused)
    }
    setLoaded(true)
  }, [saved, isLoading, loaded])

  const updateDay = (key: WeekdayKey, changes: Partial<DayState>) =>
    setWeek((current) => ({
      ...current,
      [key]: { ...current[key], ...changes },
    }))

  const addArea = () => {
    const value = areaInput.trim()
    if (!value) return
    if (!areas.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setAreas((current) => [...current, value])
    }
    setAreaInput('')
  }

  const handleSave = async () => {
    if (!profile) return

    const weekly_hours: Record<string, { open: string; close: string } | null> =
      {}
    if (limitHours) {
      for (const { key, label } of WEEKDAYS) {
        const day = week[key]
        if (!day.on) {
          weekly_hours[key] = null
        } else if (day.close <= day.open) {
          toast.error(`${label}: closing time must be after opening time`)
          return
        } else {
          weekly_hours[key] = { open: day.open, close: day.close }
        }
      }
    }

    setSaving(true)
    try {
      await saveCookAvailability(profile.id, {
        weekly_hours,
        max_orders_per_day: maxOrders ? Number(maxOrders) : null,
        notice_hours: noticeHours ? Number(noticeHours) : null,
        service_areas: areas,
        is_paused: paused,
      })
      toast.success('Availability saved')
      queryClient.invalidateQueries({ queryKey: ['cook-availability'] })
    } catch {
      toast.error('Could not save availability')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Availability
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Set when you cook, how much you take on, and where you serve.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 p-4"
      >
        <div className="f4l-card flex items-center justify-between gap-3 p-4">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              Pause new bookings
            </p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Buyers will see you're not taking orders right now.
            </p>
          </div>
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--accent)]"
            aria-label="Pause new bookings"
          />
        </div>

        <div className="f4l-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--text-1)' }}
              >
                Weekly hours
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Turn off to accept bookings on any day.
              </p>
            </div>
            <input
              type="checkbox"
              checked={limitHours}
              onChange={(e) => setLimitHours(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              aria-label="Only take bookings during set hours"
            />
          </div>

          {limitHours && (
            <div className="space-y-2 pt-1">
              {WEEKDAYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex w-24 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={week[key].on}
                      onChange={(e) => updateDay(key, { on: e.target.checked })}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span style={{ color: 'var(--text-1)' }}>
                      {label.slice(0, 3)}
                    </span>
                  </label>
                  {week[key].on ? (
                    <>
                      <input
                        type="time"
                        value={week[key].open}
                        onChange={(e) =>
                          updateDay(key, { open: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-3)' }}
                      >
                        to
                      </span>
                      <input
                        type="time"
                        value={week[key].close}
                        onChange={(e) =>
                          updateDay(key, { close: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Closed
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="f4l-card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--text-1)' }}
              >
                Orders per day
              </label>
              <input
                type="number"
                min={1}
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
                placeholder="No limit"
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
                value={noticeHours}
                onChange={(e) => setNoticeHours(e.target.value)}
                placeholder="None"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--text-1)' }}
            >
              Areas you serve
            </label>
            {areas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {areas.map((area) => (
                  <span key={area} className="f4l-badge f4l-badge-accent">
                    {area}
                    <button
                      onClick={() =>
                        setAreas((current) => current.filter((a) => a !== area))
                      }
                      aria-label={`Remove ${area}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addArea()
                  }
                }}
                placeholder="Lekki, Victoria Island…"
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={addArea}
                className="rounded-xl bg-[var(--bg-2)] px-4 text-sm font-semibold text-[var(--text-2)]"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full bg-[var(--accent)]"
          loading={saving}
          onClick={handleSave}
        >
          Save availability
        </Button>
      </motion.div>
    </div>
  )
}
