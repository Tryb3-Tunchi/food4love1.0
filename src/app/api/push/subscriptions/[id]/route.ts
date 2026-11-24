import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_PATTERN, isPushSchemaMissing } from '@/lib/push/server'

// Remove one of MY devices. Ownership is part of the DELETE itself (id AND user_id), so a guessed
// or leaked id belonging to someone else matches nothing. The answer is the same 404 either way,
// so this cannot be used to find out whether another member's device id exists.

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )
  if (!UUID_PATTERN.test(params.id))
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: noStore },
    )

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
  if (error) {
    if (isPushSchemaMissing(error))
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: noStore },
      )
    return NextResponse.json(
      { error: 'Could not remove device' },
      { status: 500, headers: noStore },
    )
  }
  if (!data || data.length === 0)
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: noStore },
    )
  return NextResponse.json({ removed: true }, { headers: noStore })
}
