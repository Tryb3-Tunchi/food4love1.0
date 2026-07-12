'use client'
import { ChefHat, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatNaira } from '@/lib/utils'
import { Profile } from '@/types/db'

interface BookingCTAProps {
  chef: Profile
}

export function BookingCTA({ chef }: BookingCTAProps) {
  return (
    <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-ember/30 bg-ember/5 p-3 dark:bg-ember/10">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember/10">
        <ChefHat className="h-5 w-5 text-ember" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink dark:text-cream">
          {chef.full_name}
        </p>
        {chef.price_min && (
          <p className="text-xs text-ash">
            From {formatNaira(chef.price_min)} per meal
          </p>
        )}
      </div>
      <Button size="sm" variant="ember" className="shrink-0">
        <Calendar className="mr-1.5 h-3.5 w-3.5" />
        Book
      </Button>
    </div>
  )
}
