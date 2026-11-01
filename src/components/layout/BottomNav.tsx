'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import {
  Film,
  Flame,
  Inbox,
  MessageCircle,
  MapPin,
  User,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useNotifications } from '@/hooks/useNotifications'
import { useActiveStories } from '@/hooks/useActiveStories'
import { RingFrame } from '@/components/stories/StoryRing'
import { NavBadge } from './NavBadge'

const buyerLinks = [
  { href: '/swipe', label: 'Discover', icon: Flame, badge: 'none' },
  { href: '/matches', label: 'Matches', icon: Users, badge: 'notifications' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, badge: 'notifications' },
  { href: '/map', label: 'Map', icon: MapPin, badge: 'none' },
  { href: '/profile', label: 'Profile', icon: User, badge: 'none' },
]

const cookLinks = [
  { href: '/swipe', label: 'Discover', icon: Flame, badge: 'none' },
  { href: '/requests', label: 'Requests', icon: Inbox, badge: 'notifications' },
  { href: '/stories', label: 'Stories', icon: Film, badge: 'none' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, badge: 'notifications' },
  { href: '/profile', label: 'Profile', icon: User, badge: 'none' },
]

const spring = { type: 'spring', stiffness: 460, damping: 36 } as const

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()
  const { unreadCount } = useNotifications()
  const isCook = profile?.role === 'cook'
  const links = isCook ? cookLinks : buyerLinks
  const { data: liveStories = [] } = useActiveStories(profile?.id, isCook)

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
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <LayoutGroup>
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-lift backdrop-blur-xl">
          {links.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`)
            const Icon = link.icon
            const showBadge = link.badge === 'notifications' && unreadCount > 0
            const isProfile = link.href === '/profile'
            const showAvatar = isProfile && !!profile?.avatar_url

            return (
              <motion.div key={link.href} layout transition={spring}>
                <motion.div whileTap={{ scale: 0.88 }}>
                  <Link
                    href={link.href}
                    aria-label={link.label}
                    aria-current={isActive ? 'page' : undefined}
                    data-tour={link.href === '/chat' ? 'nav-chat' : undefined}
                    className="relative flex h-11 items-center gap-1.5 rounded-full px-3.5"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        transition={spring}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            'linear-gradient(135deg, #ff9a52, var(--accent))',
                          boxShadow: 'var(--shadow-warm)',
                        }}
                      />
                    )}

                    <motion.span
                      key={isActive ? 'on' : 'off'}
                      initial={isActive ? { scale: 0.5, rotate: -28 } : false}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 520,
                        damping: 13,
                      }}
                      className={`relative z-10 flex items-center ${
                        isActive ? 'text-white' : 'text-[var(--text-3)]'
                      }`}
                    >
                      <motion.span
                        className="relative flex"
                        animate={
                          isActive && link.href === '/swipe'
                            ? {
                                scale: [1, 1.14, 0.96, 1.1, 1],
                                rotate: [0, -7, 5, -3, 0],
                              }
                            : {}
                        }
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {showAvatar ? (
                          <RingFrame
                            count={isActive ? 0 : liveStories.length}
                            thickness={2}
                            gap={1.5}
                            gapColor="var(--card)"
                          >
                            <img
                              src={profile!.avatar_url!}
                              alt=""
                              className={`h-6 w-6 rounded-full object-cover ${
                                isActive ? 'ring-2 ring-white' : ''
                              }`}
                            />
                          </RingFrame>
                        ) : (
                          <Icon
                            className="h-[22px] w-[22px]"
                            strokeWidth={isActive ? 2.4 : 2}
                          />
                        )}
                        {showBadge && <NavBadge count={unreadCount} />}
                      </motion.span>
                    </motion.span>

                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.span
                          key="label"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 'auto', opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="relative z-10 overflow-hidden whitespace-nowrap text-xs font-bold text-white"
                        >
                          {link.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </LayoutGroup>
    </nav>
  )
}
