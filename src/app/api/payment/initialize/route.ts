import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, amount, metadata } = await req.json()

    if (!email || !amount) {
      return NextResponse.json(
        { error: 'Email and amount required' },
        { status: 400 },
      )
    }

    // FIX: await the server client
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount,
          metadata,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/verify`,
        }),
      },
    )

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message }, { status: 400 })
    }

    return NextResponse.json(data.data)
  } catch (error) {
    console.error('Payment initialize error:', error)
    return NextResponse.json(
      { error: 'Payment initialization failed' },
      { status: 500 },
    )
  }
}
