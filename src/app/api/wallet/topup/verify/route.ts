import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ reference: z.string().trim().min(1).max(100) })

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
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid payment reference' },
      { status: 400 },
    )
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey)
    return NextResponse.json(
      { error: 'Paystack is not configured' },
      { status: 503 },
    )

  try {
    const admin = createAdminClient()
    const { data: topup, error: lookupError } = await admin
      .from('wallet_topups')
      .select('amount_naira, status, paystack_reference')
      .eq('user_id', user.id)
      .eq('paystack_reference', parsed.data.reference)
      .maybeSingle()
    if (lookupError || !topup)
      return NextResponse.json(
        { error: 'Wallet funding was not found' },
        { status: 404 },
      )
    if (topup.status === 'paid')
      return NextResponse.json({ success: true, already_credited: true })
    if (topup.status !== 'pending')
      return NextResponse.json(
        { error: 'Wallet funding is no longer pending' },
        { status: 409 },
      )

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(topup.paystack_reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    )
    const result = await response.json()
    if (
      !response.ok ||
      !result.status ||
      result.data?.status !== 'success' ||
      result.data?.reference !== topup.paystack_reference ||
      result.data?.currency !== 'NGN' ||
      result.data?.amount !== topup.amount_naira * 100
    ) {
      if (result.data?.status && result.data.status !== 'success') {
        await admin.rpc('food4love_mark_wallet_topup_failed', {
          p_reference: topup.paystack_reference,
        })
      }
      return NextResponse.json(
        {
          error:
            'Payment was not successful or did not match the expected amount',
        },
        { status: 400 },
      )
    }

    const { error: creditError } = await admin.rpc(
      'food4love_complete_wallet_topup',
      {
        p_reference: topup.paystack_reference,
      },
    )
    if (creditError)
      return NextResponse.json(
        { error: 'Payment verified, but wallet credit needs support review' },
        { status: 503 },
      )
    return NextResponse.json({
      success: true,
      amount_naira: topup.amount_naira,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not verify wallet payment' },
      { status: 500 },
    )
  }
}
