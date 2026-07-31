import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'border-[var(--border)]/50 animate-pulse rounded-md border bg-[var(--bg-2)]',
        className,
      )}
    />
  )
}
