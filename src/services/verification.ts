import { createClient } from '@/lib/supabase/client'

export interface MyKycSubmission {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
}

// A cook can read their own submissions; returns null if there is none or the
// read is not allowed.
export async function getMyLatestKycSubmission(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('id, status, rejection_reason, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as MyKycSubmission | null
}
