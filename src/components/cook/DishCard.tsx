'use client'

import {
  Clock,
  Pause,
  Pencil,
  Play,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { formatNaira } from '@/lib/utils'
import type { DailySpecial } from '@/types/db'

interface DishCardProps {
  special: DailySpecial
  onEdit: (special: DailySpecial) => void
  onTogglePause: (special: DailySpecial) => void
  onEndNow: (special: DailySpecial) => void
  onDelete: (special: DailySpecial) => void
}

const ACTION =
  'flex items-center gap-1.5 rounded-lg bg-[var(--bg-2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-2)]'

export function DishCard({
  special,
  onEdit,
  onTogglePause,
  onEndNow,
  onDelete,
}: DishCardProps) {
  const details = [
    special.serving_size ? `Serves ${special.serving_size}` : null,
    special.portions_available != null
      ? `${special.portions_available} left`
      : null,
    special.lead_time_hours ? `${special.lead_time_hours}h notice` : null,
    special.fulfillment_options?.length
      ? special.fulfillment_options.join(' / ')
      : null,
  ].filter(Boolean)

  return (
    <div className="f4l-card overflow-hidden">
      <div
        className="relative aspect-[4/3] w-full"
        style={{
          background:
            'linear-gradient(135deg, var(--accent-l), var(--divider))',
        }}
      >
        {special.image_url ? (
          <img
            src={special.image_url}
            alt={special.title}
            className={`h-full w-full object-cover ${special.is_paused ? 'opacity-60' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed
              className="h-10 w-10"
              style={{ color: 'var(--accent)' }}
            />
          </div>
        )}
        <span
          className={`f4l-badge absolute left-3 top-3 ${
            special.is_paused ? 'f4l-badge-warning' : 'f4l-badge-success'
          }`}
        >
          {special.is_paused ? 'Paused' : 'Live'}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
          <p className="truncate text-base font-semibold text-white">
            {special.title}
          </p>
          <p className="text-sm font-bold text-white/90">
            {formatNaira(special.price)}
          </p>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Until{' '}
          {new Date(special.available_until).toLocaleString('en-NG', {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
          {details.length > 0 ? ` · ${details.join(' · ')}` : ''}
        </p>
        {special.allergens && special.allergens.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Contains: {special.allergens.join(', ')}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => onEdit(special)} className={ACTION}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button onClick={() => onTogglePause(special)} className={ACTION}>
            {special.is_paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            {special.is_paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={() => onEndNow(special)} className={ACTION}>
            <Clock className="h-3.5 w-3.5" />
            End now
          </button>
          <button
            onClick={() => onDelete(special)}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--text-3)] hover:bg-red-500/10 hover:text-red-500"
            aria-label="Delete dish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
