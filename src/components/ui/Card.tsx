import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  hoverable?: boolean
}

export function Card({ className, hoverable, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'f4l-card',
        hoverable &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-pepper/20 hover:shadow-lift',
        className,
      )}
      {...props}
    />
  )
}
