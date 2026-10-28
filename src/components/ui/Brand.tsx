'use client'

import Image from 'next/image'
import Link from 'next/link'

export function Brand({
  href = '/',
  size = 'regular',
  tone = 'light',
  onClick,
  className = '',
}: {
  href?: string
  size?: 'compact' | 'regular' | 'large'
  tone?: 'light' | 'dark'
  onClick?: () => void
  className?: string
}) {
  const markSize = size === 'large' ? 42 : size === 'compact' ? 26 : 34
  const wordmarkWidth = size === 'large' ? 168 : 132
  const wordmarkHeight = size === 'large' ? 59 : 47

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label="Food4Love home"
      className={`inline-flex w-fit shrink-0 items-center gap-2 ${className}`}
    >
      <Image
        src="/logo4lfood11.png"
        alt=""
        width={markSize}
        height={Math.round(markSize * (373 / 379))}
        priority
        className="shrink-0 object-contain"
      />
      {size !== 'compact' && (
        <span
          className={`flex items-center ${tone === 'dark' ? 'rounded bg-white px-1.5' : ''}`}
        >
          <Image
            src="/logo4food22.png"
            alt="Food4Love"
            width={wordmarkWidth}
            height={wordmarkHeight}
            priority
            className="h-auto shrink-0 object-contain"
          />
        </span>
      )}
    </Link>
  )
}
