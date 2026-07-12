import { createClient } from '@/lib/supabase/client'
const sb = () => createClient()

export async function getAdminStats() {
  const [users, chefs, matches, bookings, disputes, pendingKyc] =
    await Promise.all([
      sb().from('profiles').select('id', { count: 'exact', head: true }),
      sb()
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'cook'),
      sb().from('matches').select('id', { count: 'exact', head: true }),
      sb().from('bookings').select('id', { count: 'exact', head: true }),
      sb()
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      sb()
        .from('kyc_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])
  return {
    totalUsers: users.count ?? 0,
    totalChefs: chefs.count ?? 0,
    totalMatches: matches.count ?? 0,
    totalBookings: bookings.count ?? 0,
    openDisputes: disputes.count ?? 0,
    pendingKyc: pendingKyc.count ?? 0,
  }
}

export async function getAllUsers(search?: string) {
  let q = sb()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (search) q = q.ilike('full_name', `%${search}%`)
  const { data } = await q
  return data ?? []
}

export async function suspendUser(userId: string, suspended: boolean) {
  await sb()
    .from('profiles')
    .update({ suspended } as any)
    .eq('id', userId)
}
