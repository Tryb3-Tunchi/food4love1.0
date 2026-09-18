import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, amount, booking_id, metadata } = body

    if (!email || !amount || !booking_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, amount, booking_id' },
        { status: 400 },
      )
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Paystack secret key not configured' },
        { status: 500 },
      )
    }

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // Paystack uses kobo
          reference: `f4l_${booking_id}_${Date.now()}`,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking_id}`,
          metadata: {
            ...metadata,
            booking_id,
            custom_fields: [
              {
                display_name: 'Booking ID',
                variable_name: 'booking_id',
                value: booking_id,
              },
            ],
          },
        }),
      },
    )

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json(
        { error: data.message || 'Paystack initialization failed' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
    })
  } catch (error: any) {
    console.error('Paystack initialize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
