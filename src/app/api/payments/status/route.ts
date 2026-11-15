import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Tells the booking screens whether online payment is set up, so they can say so
// honestly instead of showing a Pay button that cannot work. Reports only a yes/no:
// no key, no value and no account detail ever leaves the server.
export async function GET() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const available = Boolean(
    process.env.PAYSTACK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  )
  return NextResponse.json(
    { available },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
