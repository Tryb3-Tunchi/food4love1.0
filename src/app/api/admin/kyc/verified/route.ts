import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Verified cooks, so an administrator can take an approval back. Names only: no ID
// numbers, documents or contact details are returned here.
export async function GET() {
  const user = await getAdminUser('kyc:review')
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('role', 'cook')
    .eq('kyc_status', 'verified')
    .order('full_name', { ascending: true })
    .limit(200)
  if (error) {
    return NextResponse.json(
      { error: 'Could not load verified cooks' },
      { status: 500 },
    )
  }
  return NextResponse.json({ cooks: data ?? [] })
}
