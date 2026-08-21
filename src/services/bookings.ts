import { createClient } from '@/lib/supabase/client'

export interface BookingItem {
  id?: string
  booking_id?: string
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Booking {
  id: string
  buyer_id: string
  cook_id: string
  match_id: string
  status:
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'delivered'
    | 'cancelled'
    | 'disputed'
  total_amount: number
  delivery_fee: number
  service_fee: number
  scheduled_at: string
  delivery_address: string
  notes: string | null
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed'
  payment_reference: string | null
  created_at: string
  updated_at: string
  cook?: { full_name: string; avatar_url: string | null }
  buyer?: { full_name: string; avatar_url: string | null }
  items?: BookingItem[]
}

export async function createBooking(payload: {
  buyer_id: string
  cook_id: string
  match_id: string
  items: Omit<BookingItem, 'id' | 'booking_id' | 'total_price'>[]
  scheduled_at: string
  delivery_address: string
  notes?: string
  delivery_fee?: number
  service_fee?: number
}): Promise<Booking> {
  const supabase = createClient()

  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  )
  const deliveryFee = payload.delivery_fee ?? 500
  const serviceFee = payload.service_fee ?? Math.round(totalAmount * 0.05)

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      buyer_id: payload.buyer_id,
      cook_id: payload.cook_id,
      match_id: payload.match_id,
      status: 'pending',
      total_amount: totalAmount,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      scheduled_at: payload.scheduled_at,
      delivery_address: payload.delivery_address,
      notes: payload.notes ?? null,
      payment_status: 'unpaid',
    })
    .select()
    .single()

  if (error) throw error

  const bookingItems = payload.items.map((item) => ({
    booking_id: booking.id,
    item_name: item.item_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.unit_price * item.quantity,
  }))

  const { error: itemsError } = await supabase
    .from('booking_items')
    .insert(bookingItems)

  if (itemsError) throw itemsError

  return booking as Booking
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
      cook:cook_id(full_name, avatar_url),
      buyer:buyer_id(full_name, avatar_url),
      items:booking_items(*)`,
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
      cook:cook_id(full_name, avatar_url),
      buyer:buyer_id(full_name, avatar_url),
      items:booking_items(*)`,
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Booking
}

export async function updateBookingStatus(
  bookingId: string,
  status: Booking['status'],
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) throw error
}
