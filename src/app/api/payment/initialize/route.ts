import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, amount, booking_id, metadata } = body

    if (!email || !amount || !booking_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Paystack not configured' },
        { status: 500 },
      )
    }

    const reference = `F4L-${booking_id.slice(0, 8)}-${Date.now()}`

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
          amount: amount * 100, // kobo
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'}/bookings`,
          metadata: {
            ...metadata,
            booking_id,
          },
        }),
      },
    )

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json(
        { error: data.message || 'Paystack error' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    })
  } catch (err: any) {
    console.error('Paystack init error:', err)
    return NextResponse.json(
      { error: err.message || 'Payment initialization failed' },
      { status: 500 },
    )
  }
}
