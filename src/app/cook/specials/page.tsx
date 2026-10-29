'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Camera, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getDailySpecialsByCook,
  updateDailySpecial,
  deleteDailySpecial,
} from '@/services/dailySpecials'
import { DishCard } from '@/components/cook/DishCard'
import { DishFormSheet } from '@/components/cook/DishFormSheet'
import type { DailySpecial } from '@/types/db'

export default function CookSpecialsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login')
  }, [authLoading, profile, router])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DailySpecial | null>(null)

  const { data: specials = [], isLoading } = useQuery<DailySpecial[]>({
    queryKey: ['daily-specials', profile?.id],
    queryFn: () => getDailySpecialsByCook(profile!.id),
    enabled: !!profile?.id,
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['daily-specials'] })

  const openAdd = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  const openEdit = (special: DailySpecial) => {
    setEditing(special)
    setSheetOpen(true)
  }

  const handleTogglePause = async (special: DailySpecial) => {
    try {
      await updateDailySpecial(special.id, { is_paused: !special.is_paused })
      toast.success(special.is_paused ? 'Dish is live again' : 'Dish paused')
      refresh()
    } catch {
      toast.error('Could not update dish')
    }
  }

  const handleEndNow = async (special: DailySpecial) => {
    try {
      await updateDailySpecial(special.id, {
        available_until: new Date().toISOString(),
      })
      toast.success('Dish ended')
      refresh()
    } catch {
      toast.error('Could not end dish')
    }
  }

  const handleDelete = async (special: DailySpecial) => {
    if (!window.confirm(`Delete “${special.title}”? This can’t be undone.`)) {
      return
    }
    try {
      await deleteDailySpecial(special.id)
      toast.success('Dish removed')
      refresh()
    } catch {
      toast.error('Failed to remove dish')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            My menu
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Post, edit, pause or end your dishes.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          style={{
            background: 'var(--accent)',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          <Plus className="h-4 w-4" />
          Add a dish
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4"
      >
        {isLoading ? (
          <p className="text-sm text-[var(--text-3)]">Loading...</p>
        ) : specials.length === 0 ? (
          <button
            onClick={openAdd}
            className="flex aspect-[4/3] w-full max-w-md flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm font-semibold">Add your first dish</span>
            <span className="text-xs">Start with a photo of what you cook</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specials.map((special) => (
              <DishCard
                key={special.id}
                special={special}
                onEdit={openEdit}
                onTogglePause={handleTogglePause}
                onEndNow={handleEndNow}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </motion.div>

      {profile && (
        <DishFormSheet
          open={sheetOpen}
          cookId={profile.id}
          editing={editing}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
