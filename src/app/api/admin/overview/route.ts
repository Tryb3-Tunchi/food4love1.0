import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const actor = await getAdminUser()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const permissions: string[] = Array.isArray(
    actor.app_metadata?.admin_permissions,
  )
    ? actor.app_metadata.admin_permissions
    : []
  const can = (permission: string) => permissions.includes(permission)
  const admin = createAdminClient()
  const noAccess = Promise.resolve({ count: null, error: null })
  const results = await Promise.all([
    can('users:manage')
      ? admin.from('profiles').select('id', { count: 'exact', head: true })
      : noAccess,
    can('users:manage')
      ? admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'cook')
      : noAccess,
    can('matches:manage')
      ? admin
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'matched')
      : noAccess,
    can('bookings:manage')
      ? admin.from('bookings').select('id', { count: 'exact', head: true })
      : noAccess,
    can('disputes:manage')
      ? admin
          .from('disputes')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'ai_reviewed', 'admin_review'])
      : noAccess,
    can('kyc:review')
      ? admin
          .from('kyc_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      : noAccess,
    can('users:manage')
      ? admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('suspended', true)
      : noAccess,
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
  const counts = results.map((result) => result.count)
  const permissionsByMetric = [
    'users:manage',
    'users:manage',
    'matches:manage',
    'bookings:manage',
    'disputes:manage',
    'kyc:review',
    'users:manage',
  ]
  const restrictedMetrics = keys.filter(
    (_, index) => !can(permissionsByMetric[index]),
  )

  return NextResponse.json({
    totalUsers: counts[0],
    totalChefs: counts[1],
    totalMatches: counts[2],
    totalBookings: counts[3],
    openDisputes: counts[4],
    pendingKyc: counts[5],
    suspendedUsers: counts[6],
    dataCheckFailures: failures,
    restrictedMetrics,
  })
}
