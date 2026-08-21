'use client'

interface NavBadgeProps {
  count: number
}

export function NavBadge({ count }: NavBadgeProps) {
  if (count <= 0) return null

  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#E8390E] px-1.5 text-[10px] font-bold text-white shadow-lg ring-2 ring-[#0F0A05]">
      {count > 99 ? '99+' : count}
    </span>
  )
}
