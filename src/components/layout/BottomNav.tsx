'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Flame, MessageCircle, MapPin, User, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

const buyerLinks = [
  { href: '/swipe', label: 'Discover', icon: Flame },
  { href: '/matches', label: 'Matches', icon: Users },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/map', label: 'Map', icon: MapPin },
  { href: '/profile', label: 'Profile', icon: User },
]

const cookLinks = [
  { href: '/swipe', label: 'Discover', icon: Flame },
  { href: '/requests', label: 'Requests', icon: Users },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/likes', label: 'Likes', icon: MessageCircle }, // You can change icon
  { href: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const isCook = profile?.role === 'cook'
  const links = isCook ? cookLinks : buyerLinks

  // Hide on auth pages
  if (
    !pathname ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/onboarding')
  ) {
    return null
  }

  return (
    <nav className="bg-[var(--bg)]/90 safe-area-pb fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`)
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-colors ${
                isActive
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-2 h-1 w-8 rounded-full bg-[var(--primary)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
