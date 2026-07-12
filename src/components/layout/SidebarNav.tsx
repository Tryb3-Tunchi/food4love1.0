'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Flame,
  Heart,
  MessageCircle,
  User,
  Map,
  ChefHat,
  Shield,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui/Avatar'

const buyerNav = [
  { href: '/swipe', icon: Flame, label: 'Discover', id: 'bottom-nav-swipe' },
  { href: '/matches', icon: Heart, label: 'Matches', id: 'bottom-nav-matches' },
  { href: '/chat', icon: MessageCircle, label: 'Chat', id: 'bottom-nav-chat' },
  { href: '/map', icon: Map, label: 'Map', id: '' },
  { href: '/profile', icon: User, label: 'Profile', id: '' },
]
const cookNav = [
  { href: '/requests', icon: Flame, label: 'Requests', id: '' },
  { href: '/matches', icon: Heart, label: 'Matches', id: 'bottom-nav-matches' },
  { href: '/chat', icon: MessageCircle, label: 'Chat', id: 'bottom-nav-chat' },
  { href: '/profile', icon: User, label: 'Profile', id: '' },
]

export function SidebarNav() {
  const pathname = usePathname()
  const profile = useAuthStore((s) => s.profile)
  const nav = profile?.role === 'cook' ? cookNav : buyerNav

  return (
    <aside className="f4l-nav fixed left-0 top-0 z-20 hidden h-full w-64 flex-col border-r lg:flex">
      {/* Logo */}
      <div
        className="border-b p-5 pb-4"
        style={{ borderColor: 'var(--nav-border)' }}
      >
        <Link href="/swipe" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-alt), var(--accent))',
            }}
          >
            <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <span
            className="text-xl font-extrabold tracking-tight"
            style={{ color: 'var(--text-1)' }}
          >
            Food<span style={{ color: '#E8390E' }}>4</span>Love
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, icon: Icon, label, id }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              id={id || undefined}
              href={href}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--nav-text)',
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={active ? 2.5 : 1.8}
                style={{
                  color: active ? 'var(--accent)' : 'var(--nav-dim)',
                }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* KYC warning */}
      {profile?.role === 'cook' && profile.kyc_status !== 'verified' && (
        <div
          className="mx-3 mb-3 rounded-2xl p-3"
          style={{
            background: 'color-mix(in srgb, var(--accent-alt) 12%, white 88%)',
            border:
              '1px solid color-mix(in srgb, var(--accent-alt) 28%, white 72%)',
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Shield
              className="h-4 w-4"
              style={{ color: 'var(--accent-alt)' }}
            />
            <span
              className="text-xs font-bold"
              style={{ color: 'var(--accent-alt)' }}
            >
              {profile.kyc_status === 'pending'
                ? 'KYC Under Review'
                : 'Verify to Sell'}
            </span>
          </div>
          {profile.kyc_status !== 'pending' && (
            <Link
              href="/onboarding/kyc"
              className="text-[11px]"
              style={{
                color: 'color-mix(in srgb, var(--accent-alt) 72%, black 28%)',
              }}
            >
              Complete verification →
            </Link>
          )}
        </div>
      )}

      {/* Profile */}
      {profile && (
        <div
          className="border-t p-3"
          style={{ borderColor: 'var(--nav-border)' }}
        >
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl p-2.5 transition-all"
            style={{
              background:
                pathname === '/profile' ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <Avatar
              src={profile.avatar_url}
              name={profile.full_name}
              size="sm"
              verified={profile.is_verified}
            />
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: 'var(--text-1)' }}
              >
                {profile.full_name}
              </p>
              <p
                className="text-xs capitalize"
                style={{ color: 'var(--text-3)' }}
              >
                {profile.role}
                {profile.kyc_status === 'verified' ? ' · ✓ Verified' : ''}
              </p>
            </div>
          </Link>
        </div>
      )}
    </aside>
  )
}
