import { createClient } from '@/lib/supabase/client'

type SupabaseBrowserClient = ReturnType<typeof createClient>

export async function getPostLoginRedirect(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, onboarding_complete')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the signed-in profile', { cause: error })
  }

  if (!profile) return '/onboarding/role'
  if (profile.onboarding_complete !== true) return '/onboarding/setup'
  return profile.role === 'cook' ? '/dashboard' : '/swipe'
}
