'use client'
import { X, Heart, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwipeActionsProps {
  onPass: () => void
  onLike: () => void
  onSuperlike?: () => void
  disabled?: boolean
}

export function SwipeActions({
  onPass,
  onLike,
  onSuperlike,
  disabled,
}: SwipeActionsProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={onPass}
        disabled={disabled}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-400 bg-white text-red-400 shadow-float transition-all hover:bg-red-50 active:scale-95 dark:bg-smoke dark:hover:bg-red-900/20',
          disabled && 'opacity-40',
        )}
      >
        <X className="h-6 w-6" strokeWidth={2.5} />
      </button>
      {onSuperlike && (
        <button
          onClick={onSuperlike}
          disabled={disabled}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border-2 border-ember bg-white text-ember shadow-float transition-all active:scale-95 dark:bg-smoke',
            disabled && 'opacity-40',
          )}
        >
          <Star className="h-5 w-5" />
        </button>
      )}
      <button
        onClick={onLike}
        disabled={disabled}
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pepper to-ember text-white shadow-glow transition-all hover:shadow-[0_0_40px_rgba(232,57,14,0.5)] active:scale-95',
          disabled && 'opacity-40',
        )}
      >
        <Heart className="h-7 w-7 fill-white" />
      </button>
    </div>
  )
}
