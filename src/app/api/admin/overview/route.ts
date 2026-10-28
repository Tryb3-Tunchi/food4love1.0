import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const actor = await getAdminUser()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const results = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'cook'),
    admin.from('matches').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'ai_reviewed', 'admin_review']),
    admin
      .from('kyc_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('suspended', true),
  ])
  const keys = [
    'users',
    'chefs',
    'matches',
    'bookings',
    'openDisputes',
    'pendingKyc',
    'suspendedUsers',
  ]
  const failures = results.flatMap((result, index) =>
    result.error ? [keys[index]] : [],
  )
  const counts = results.map((result) => result.count ?? 0)

  return NextResponse.json({
    totalUsers: counts[0],
    totalChefs: counts[1],
    totalMatches: counts[2],
    totalBookings: counts[3],
    openDisputes: counts[4],
    pendingKyc: counts[5],
    suspendedUsers: counts[6],
    dataCheckFailures: failures,
  })
}
