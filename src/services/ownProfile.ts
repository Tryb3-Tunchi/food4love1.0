import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/types/db'
import {
  PRIVATE_PROFILE_SELECT,
  PUBLIC_PROFILE_SELECT,
} from '@/lib/profileColumns'

// A member's own private settings (referral code, notification and email choices,
// adult confirmation). They come from get_my_private_profile(), which returns only
// the caller's own row. Before the privacy migration is applied that function does
// not exist yet, so the owner can still read the columns directly; this keeps the
// application working whichever order the code and the migration are deployed in.
export async function fetchOwnPrivate(
  supabase: SupabaseClient,
  userId: string,
): Promise<Partial<Profile> & { age_confirmed_at?: string | null }> {
  const viaFunction = await supabase.rpc('get_my_private_profile')
  if (!viaFunction.error && viaFunction.data) {
    const row = Array.isArray(viaFunction.data)
      ? viaFunction.data[0]
      : viaFunction.data
    if (row) return row
  }
  const { data } = await supabase
    .from('profiles')
    .select(PRIVATE_PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()
  return (data as Partial<Profile> | null) ?? {}
}

export async function fetchOwnProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data: base } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()
  if (!base) return null
  const priv = await fetchOwnPrivate(supabase, userId)
  return { ...(base as unknown as Profile), ...priv }
}
