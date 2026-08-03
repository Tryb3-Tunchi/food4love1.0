import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      cook_id,
      match_id,
      meal_description,
      delivery_date,
      delivery_time,
      delivery_type,
      address,
      special_requests,
      guests,
      amount,
    } = body

    if (
      !cook_id ||
      !match_id ||
      !meal_description ||
      !delivery_date ||
      !delivery_time ||
      !amount
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        buyer_id: user.id,
        cook_id,
        match_id,
        meal_description,
        delivery_date,
        delivery_time,
        delivery_type,
        address,
        special_requests,
        guests,
        amount,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Booking insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err: any) {
    console.error('Booking API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
