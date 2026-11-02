import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ amount_naira: z.number().int().min(500).max(500000) })

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  }
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user?.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Choose an amount between ₦500 and ₦500,000' },
      { status: 400 },
    )
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey)
    return NextResponse.json(
      { error: 'Paystack is not configured' },
      { status: 503 },
    )

  try {
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('suspended, role')
      .eq('id', user.id)
      .maybeSingle()
    if (
      profileError ||
      !profile ||
      profile.suspended ||
      !['buyer', 'cook'].includes(profile.role ?? '')
    ) {
      return NextResponse.json(
        { error: 'Account is not eligible for wallet funding' },
        { status: 403 },
      )
    }

    const reference = `f4l_wallet_${randomUUID()}`
    const { error: insertError } = await admin.from('wallet_topups').insert({
      user_id: user.id,
      amount_naira: parsed.data.amount_naira,
      paystack_reference: reference,
    })
    if (insertError)
      return NextResponse.json(
        { error: 'Could not start wallet funding' },
        { status: 500 },
      )

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/wallet/verify?reference=${encodeURIComponent(reference)}`
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: parsed.data.amount_naira * 100,
          reference,
          callback_url: callbackUrl,
          metadata: { purpose: 'wallet_topup', user_id: user.id },
        }),
      },
    )
    const result = await response.json()
    if (
      !response.ok ||
      !result.status ||
      result.data?.reference !== reference
    ) {
      await admin.rpc('food4love_mark_wallet_topup_failed', {
        p_reference: reference,
      })
      return NextResponse.json(
        { error: 'Paystack could not start wallet funding' },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { authorization_url: result.data.authorization_url },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Could not start wallet funding' },
      { status: 500 },
    )
  }
}
