'use client'
import { useState } from 'react'
import { ChefHat, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BookingForm } from '@/components/booking/BookingForm'
import { formatNaira } from '@/lib/utils'
import { Profile } from '@/types/db'

interface BookingCTAProps {
  chef: Profile
  matchId: string
}

export function BookingCTA({ chef, matchId }: BookingCTAProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        className="mx-4 mb-3 flex items-center gap-3 rounded-xl p-3"
        style={{
          background: 'color-mix(in srgb, var(--accent-alt) 8%, transparent)',
          border:
            '1px solid color-mix(in srgb, var(--accent-alt) 25%, transparent)',
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background:
              'color-mix(in srgb, var(--accent-alt) 12%, transparent)',
          }}
        >
          <ChefHat className="h-5 w-5" style={{ color: 'var(--accent-alt)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            {chef.full_name}
          </p>
          {chef.price_min && (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              From {formatNaira(chef.price_min)} per meal
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="primary"
          className="shrink-0 text-white"
          onClick={() => setOpen(true)}
          style={{ background: 'var(--accent)' }}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          Book
        </Button>
      </div>

      <BookingForm
        isOpen={open}
        chef={chef}
        matchId={matchId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
