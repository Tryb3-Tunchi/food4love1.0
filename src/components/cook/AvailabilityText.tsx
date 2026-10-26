'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getCookAvailability } from '@/services/availability'
import { hasWeeklySchedule, summarizeHours } from '@/lib/availability'

export function AvailabilityText({ cookId }: { cookId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cook-availability', cookId],
    queryFn: () => getCookAvailability(cookId),
  })

  if (isLoading) return <>…</>

  const summary = data
    ? [
        data.is_paused ? 'Paused' : null,
        hasWeeklySchedule(data) ? summarizeHours(data.weekly_hours) : 'Any day',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Not set yet'

  return (
    <>
      {summary}{' '}
      <Link
        href="/cook/availability"
        className="text-xs font-bold"
        style={{ color: 'var(--accent)' }}
      >
        {data ? 'Edit' : 'Set hours'}
      </Link>
    </>
  )
}
