import { Clock, Hourglass, MapPin } from 'lucide-react'
import { hasWeeklySchedule, summarizeHours } from '@/lib/availability'
import type { CookAvailability } from '@/types/db'

export function AvailabilityCard({
  availability,
}: {
  availability: CookAvailability
}) {
  const rows = [
    hasWeeklySchedule(availability) && {
      icon: Clock,
      label: 'Hours',
      value: summarizeHours(availability.weekly_hours),
    },
    availability.notice_hours
      ? {
          icon: Hourglass,
          label: 'Notice needed',
          value: `${availability.notice_hours} hours`,
        }
      : false,
    availability.service_areas.length > 0 && {
      icon: MapPin,
      label: 'Serves',
      value: availability.service_areas.join(', '),
    },
  ].filter(Boolean) as {
    icon: typeof Clock
    label: string
    value: string
  }[]

  if (rows.length === 0 && !availability.is_paused) return null

  return (
    <div className="f4l-card mb-5 divide-y divide-[var(--divider)]">
      {availability.is_paused && (
        <div className="p-4">
          <span className="f4l-badge f4l-badge-warning">
            Not taking new bookings right now
          </span>
        </div>
      )}
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-3 p-4">
          <Icon
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--accent)' }}
          />
          <div className="flex-1">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {label}
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
