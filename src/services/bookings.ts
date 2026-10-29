import { createClient } from '@/lib/supabase/client'

export interface Booking {
  id: string
  buyer_id: string
  cook_id: string
  match_id: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed' | 'pending'
  amount?: number
  price: number
  delivery_fee?: number
  service_fee?: number
  scheduled_for?: string
  service_address?: string
  guest_count?: number
  meal_description?: string
  special_requests?: string | null
  payment_reference: string | null
  created_at: string
  updated_at: string
  cook?: { full_name: string; avatar_url: string | null }
  buyer?: { full_name: string; avatar_url: string | null }
}

export async function createBooking(payload: {
  cook_id: string
  match_id: string
  items: { special_id: string; quantity: number }[]
  scheduled_at: string
  service_address: string
  special_requests?: string
  guest_count: number
}): Promise<Booking> {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Could not send booking request')
  }
  return result.booking as Booking
}

export async function getMyBookings(
  userId: string,
  role: 'buyer' | 'cook',
): Promise<Booking[]> {
  const supabase = createClient()
  const column = role === 'buyer' ? 'buyer_id' : 'cook_id'

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*,
      cook:profiles!bookings_cook_id_fkey(full_name, avatar_url),
      buyer:profiles!bookings_buyer_id_fkey(full_name, avatar_url)`,
    )
    .eq(column, userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Booking[]
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `*,
      cook:profiles!bookings_cook_id_fkey(full_name, avatar_url),
      buyer:profiles!bookings_buyer_id_fkey(full_name, avatar_url)`,
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Booking
}

export async function acceptBooking(bookingId: string): Promise<void> {
  const response = await fetch('/api/bookings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId, action: 'accept' }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || 'Could not accept booking')
  }
}
