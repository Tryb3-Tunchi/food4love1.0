'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  ChefHat,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Booking {
  id: string
  meal_description: string
  delivery_date: string
  delivery_time: string
  delivery_type: string
  amount: number
  status: string
  payment_status: string
  created_at: string
  cook: { full_name: string; avatar_url: string | null } | null
}

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*, cook:profiles!cook_id(full_name, avatar_url)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load bookings')
      console.error(error)
    } else {
      setBookings(data ?? [])
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-[#84CC16] bg-[#84CC16]/10 border-[#84CC16]/20'
      case 'pending':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20'
      case 'completed':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'cancelled':
        return 'text-red-400 bg-red-400/10 border-red-400/20'
      default:
        return 'text-white/40 bg-white/5 border-white/10'
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8390E]" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="mb-6 font-heading text-2xl font-bold text-white">
        My Bookings
      </h1>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="mb-3 text-4xl">📋</div>
          <p className="text-white/60">No bookings yet.</p>
          <p className="mt-1 text-sm text-white/40">
            Start swiping to find a chef and book your first meal!
          </p>
          <button
            onClick={() => router.push('/swipe')}
            className="mt-4 rounded-full bg-[#E8390E] px-6 py-2.5 text-sm font-bold text-white"
          >
            Find a Chef
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/bookings/${b.id}`)}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {b.cook?.avatar_url ? (
                      <img
                        src={b.cook.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ChefHat className="h-5 w-5 text-white/40" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {b.cook?.full_name ?? 'Chef'}
                    </p>
                    <p className="text-xs text-white/50">
                      {b.meal_description.slice(0, 30)}...
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {b.delivery_date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {b.delivery_time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {b.delivery_type}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(b.status)}`}
                >
                  {b.status}
                </span>
                <span className="text-sm font-bold text-[#E8390E]">
                  {formatNaira(b.amount)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
