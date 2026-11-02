'use client'

interface NavBadgeProps {
  count: number
}

export function NavBadge({ count }: NavBadgeProps) {
  if (count <= 0) return null

  return (
    <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E8390E] px-1 text-[10px] font-bold text-white shadow-lg ring-2 ring-[var(--card)]">
      <span className="absolute inset-0 animate-ping rounded-full bg-[#E8390E] opacity-40" />
      <span className="relative">{count > 99 ? '99+' : count}</span>
    </span>
  )
}
