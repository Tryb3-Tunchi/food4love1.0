'use client'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  verified?: boolean
  showOnline?: boolean
  isOnline?: boolean
}

const sizes = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
  '2xl': 'h-28 w-28 text-2xl',
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
  verified,
  showOnline,
  isOnline,
}: AvatarProps) {
  const safeName = name ?? ''
  return (
    <div className="relative inline-flex">
      <AvatarPrimitive.Root
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizes[size],
          className,
        )}
      >
        <AvatarPrimitive.Image
          src={src ?? undefined}
          alt={safeName}
          className="h-full w-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ember to-pepper font-bold text-white"
          delayMs={100}
        >
          {getInitials(safeName)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {/* Verified badge */}
      {verified && (
        <span className="h-4.5 w-4.5 absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-lime bg-lime text-[9px] font-bold text-white shadow-sm">
          ✓
        </span>
      )}

      {/* Online status */}
      {showOnline && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card shadow-sm',
            isOnline ? 'animate-pulse-soft bg-green-500' : 'bg-gray-400',
          )}
        />
      )}
    </div>
  )
}
