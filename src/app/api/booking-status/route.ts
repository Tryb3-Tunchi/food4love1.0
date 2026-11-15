import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canExpressInterest,
  cookBookable,
  customerExplanation,
  verificationState,
  VERIFICATION_LABELS,
} from '@/lib/booking/verification'
import { isMissingSchema } from '@/lib/booking/server'

// "Can I book this cook, and if not, why and what can I do?" for the signed-in customer.
// The cook's verification state is already public (it is the badge on their profile),
// so this reveals nothing private: no documents, no ID details, no other customers.
const querySchema = z.object({ cook_id: z.string().uuid() })

export async function GET(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const cookId = parsed.data.cook_id

  const admin = createAdminClient()
  const { data: cook } = await admin
    .from('profiles')
    .select('role, suspended, onboarding_complete, kyc_status')
    .eq('id', cookId)
    .maybeSingle()
  if (!cook || cook.role !== 'cook') {
    return NextResponse.json({ error: 'Cook not found' }, { status: 404 })
  }

  // An open verification submission means "under review" even if the profile has not
  // been moved to 'pending' yet.
  const { data: latest } = await admin
    .from('kyc_submissions')
    .select('status')
    .eq('user_id', cookId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const record = {
    ...cook,
    latest_submission: (latest?.status ?? null) as
      'pending' | 'approved' | 'rejected' | null,
  }
  const state = verificationState(record)
  const bookable = cookBookable(record).ok

  // The customer's own active interest request, if any (own rows only).
  let interest: {
    id: string
    notify_when_verified: boolean
    created_at: string
  } | null = null
  const { data: mine, error: interestError } = await admin
    .from('booking_interests')
    .select('id, notify_when_verified, created_at')
    .eq('customer_id', user.id)
    .eq('cook_id', cookId)
    .eq('status', 'active')
    .maybeSingle()
  if (!interestError || !isMissingSchema(interestError)) interest = mine ?? null

  return NextResponse.json(
    {
      state,
      label: VERIFICATION_LABELS[state],
      bookable,
      explanation: customerExplanation(state),
      can_express_interest: canExpressInterest(record).ok,
      interest,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
