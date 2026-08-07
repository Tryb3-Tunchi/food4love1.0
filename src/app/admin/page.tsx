'use client'
import { useEffect, useState } from 'react'
import { getAdminStats } from '@/services/admin'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  ChefHat,
  Heart,
  ShoppingBag,
  AlertTriangle,
  Shield,
  Plus,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

interface Stats {
  totalUsers: number
  totalChefs: number
  totalMatches: number
  totalBookings: number
  openDisputes: number
  pendingKyc: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: 'demo1234',
    full_name: '',
    role: 'cook' as 'cook' | 'buyer',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getAdminStats().then(setStats)
  }, [])

  const createDemoUser = async () => {
    setCreating(true)
    const sb = createClient()
    const { data, error } = await sb.auth.admin.createUser({
      email: newUser.email,
      password: newUser.password,
      email_confirm: true,
      user_metadata: { full_name: newUser.full_name, role: newUser.role },
    })
    if (error) {
      toast.error(error.message)
      setCreating(false)
      return
    }
    // Insert profile
    await sb.from('profiles').insert({
      id: data.user.id,
      full_name: newUser.full_name,
      role: newUser.role,
      kyc_status: newUser.role === 'cook' ? 'verified' : 'unverified',
      is_verified: newUser.role === 'cook',
      onboarding_complete: true,
    })
    toast.success(`${newUser.full_name} created as ${newUser.role} ✓`)
    setShowCreateUser(false)
    setNewUser({
      email: '',
      password: 'demo1234',
      full_name: '',
      role: 'cook',
    })
    setCreating(false)
    getAdminStats().then(setStats)
  }

  const seedDemoChefs = async () => {
    const t = toast.loading('Seeding demo chef accounts...')
    const sb = createClient()
    const chefs = [
      {
        email: 'adaeze@demo.food4love',
        name: 'Adaeze Okonkwo',
        bio: 'Igbo cuisine specialist. My Ofe Akwu is legendary in Lekki.',
        location: 'Lekki Phase 1, Lagos',
        cuisines: ['Igbo Cuisine', 'Nigerian Soups'],
        price_min: 7500,
      },
      {
        email: 'emeka@demo.food4love',
        name: 'Emeka Tochukwu',
        bio: 'The Jollof King of Surulere. Party Jollof is my religion.',
        location: 'Surulere, Lagos',
        cuisines: ['Jollof & Rice', 'Nigerian BBQ'],
        price_min: 12000,
      },
      {
        email: 'fatima@demo.food4love',
        name: 'Fatima Balogun',
        bio: 'Northern Nigerian cuisine with heart. Best Tuwo in Lagos.',
        location: 'Ikeja, Lagos',
        cuisines: ['Hausa Cuisine', 'Suya & Grills'],
        price_min: 6500,
      },
      {
        email: 'grace@demo.food4love',
        name: 'Grace Oduya',
        bio: 'Afang soup and fresh starch specialist from Cross River.',
        location: 'Yaba, Lagos',
        cuisines: ['Cross River Cuisine', 'Soups'],
        price_min: 8000,
      },
    ]

    for (const chef of chefs) {
      const { data: userData } = await sb.auth.admin.createUser({
        email: chef.email,
        password: 'demo1234',
        email_confirm: true,
        user_metadata: { full_name: chef.name, role: 'cook' },
      })
      if (userData?.user) {
        await sb.from('profiles').upsert({
          id: userData.user.id,
          full_name: chef.name,
          role: 'cook',
          bio: chef.bio,
          location: chef.location,
          cuisines: chef.cuisines,
          price_min: chef.price_min,
          rating: 4.8 + Math.random() * 0.2,
          review_count: Math.floor(20 + Math.random() * 50),
          is_verified: true,
          kyc_status: 'verified',
          onboarding_complete: true,
          streak: Math.floor(3 + Math.random() * 10),
        })
      }
    }
    toast.dismiss(t)
    toast.success(
      '4 demo chefs created! Log in as test@demo.food4love to swipe them.',
    )
    getAdminStats().then(setStats)
  }

  const statCards = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers,
          icon: Users,
          href: '/admin/users',
          color: '#3B82F6',
          bg: 'rgba(59,130,246,0.1)',
        },
        {
          label: 'Home Chefs',
          value: stats.totalChefs,
          icon: ChefHat,
          href: '/admin/users',
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.1)',
        },
        {
          label: 'Total Matches',
          value: stats.totalMatches,
          icon: Heart,
          href: '/admin/bookings',
          color: '#E8390E',
          bg: 'rgba(232,57,14,0.1)',
        },
        {
          label: 'Bookings',
          value: stats.totalBookings,
          icon: ShoppingBag,
          href: '/admin/bookings',
          color: '#22C55E',
          bg: 'rgba(34,197,94,0.1)',
        },
        {
          label: 'Open Disputes',
          value: stats.openDisputes,
          icon: AlertTriangle,
          href: '/admin/disputes',
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.1)',
          urgent: stats.openDisputes > 0,
        },
        {
          label: 'Pending KYC',
          value: stats.pendingKyc,
          icon: Shield,
          href: '/admin/kyc',
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.1)',
          urgent: stats.pendingKyc > 0,
        },
      ]
    : []

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Admin
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Food4Love Operations Centre
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() => getAdminStats().then(setStats)}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              pill
              onClick={() => setShowCreateUser(!showCreateUser)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add User
            </Button>
          </div>
        </div>

        {/* Create user panel */}
        {showCreateUser && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <h3 className="mb-4 text-base font-bold text-white">
              Create New User
            </h3>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Input
                label="Full Name"
                placeholder="Adaeze Okonkwo"
                value={newUser.full_name}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, full_name: e.target.value }))
                }
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <Input
                label="Email"
                type="email"
                placeholder="chef@demo.food4love"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, email: e.target.value }))
                }
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>
            <div className="mb-4 flex gap-3">
              {(['cook', 'buyer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setNewUser((p) => ({ ...p, role: r }))}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all"
                  style={
                    newUser.role === r
                      ? { background: '#E8390E', color: 'white' }
                      : {
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.5)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {r === 'cook' ? '🍳 Chef' : '🍽️ Food Lover'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={creating}
                onClick={createDemoUser}
                pill
              >
                Create User
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateUser(false)}
                className="text-white/40 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}

        {/* Seed data button */}
        <div
          className="mb-6 flex items-center justify-between rounded-2xl border p-4"
          style={{
            background: 'rgba(45,106,79,0.08)',
            borderColor: 'rgba(45,106,79,0.2)',
          }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: '#52B788' }}>
              🌱 Seed Demo Data
            </p>
            <p className="text-xs" style={{ color: 'rgba(82,183,136,0.6)' }}>
              Creates 4 realistic chef accounts you can swipe in the app
            </p>
          </div>
          <Button
            variant="surface"
            size="sm"
            pill
            onClick={seedDemoChefs}
            className="border-[#2D6A4F]/30 text-[#52B788] hover:bg-[#2D6A4F]/10"
          >
            Seed Chefs
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {statCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                href={c.href}
                className="block rounded-2xl border p-4 transition-all hover:scale-[1.01]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: c.urgent
                    ? `${c.color}40`
                    : 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: c.bg }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: c.color }} />
                  </div>
                  {c.urgent && (
                    <span
                      className="h-2 w-2 animate-pulse rounded-full"
                      style={{ background: c.color }}
                    />
                  )}
                </div>
                <div className="mb-1 text-3xl font-extrabold text-white">
                  {stats ? (
                    c.value.toLocaleString()
                  ) : (
                    <span className="opacity-20">—</span>
                  )}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {c.label}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            {
              title: 'Swipe Activity',
              desc: 'View and manage user swipes',
              href: '/admin/swipes',
              icon: Heart,
              color: 'text-pink-500',
              urgent: false,
            },
            {
              href: '/admin/kyc',
              title: 'KYC Review Queue',
              desc: 'Review chef video verifications',
              icon: '🎥',
              urgent: (stats?.pendingKyc ?? 0) > 0,
            },
            {
              href: '/admin/disputes',
              title: 'Dispute Resolution',
              desc: 'AI-analyzed buyer-chef conflicts',
              icon: '⚖️',
              urgent: (stats?.openDisputes ?? 0) > 0,
            },
            {
              href: '/admin/users',
              title: 'User Management',
              desc: 'Search, view, suspend users',
              icon: '👥',
              urgent: false,
            },
            {
              href: '/admin/bookings',
              title: 'Booking Oversight',
              desc: 'Monitor all active bookings',
              icon: '📋',
              urgent: false,
            },
          ].map((l: any) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-4 rounded-2xl border p-4 transition-all hover:bg-white/5"
              style={{
                borderColor: l.urgent
                  ? 'rgba(232,57,14,0.25)'
                  : 'rgba(255,255,255,0.06)',
                background: l.urgent
                  ? 'rgba(232,57,14,0.05)'
                  : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="shrink-0 text-2xl">
                {typeof l.icon === 'string' ? (
                  l.icon
                ) : (
                  <l.icon className={`h-6 w-6 ${l.color || ''}`} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {l.title}
                  </span>
                  {l.urgent && (
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-pepper" />
                  )}
                </div>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {l.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
