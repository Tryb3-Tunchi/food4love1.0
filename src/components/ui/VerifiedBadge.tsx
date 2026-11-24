import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VerifiedBadge({
  className,
  size = 'h-4 w-4',
}: {
  className?: string
  size?: string
}) {
  return (
    <span
      role="img"
      aria-label="Food4Love verified"
      title="Food4Love verified"
      className={cn('inline-flex shrink-0 text-[var(--success)]', className)}
    >
      <BadgeCheck className={size} aria-hidden="true" strokeWidth={2.5} />
    </span>
  )
}
