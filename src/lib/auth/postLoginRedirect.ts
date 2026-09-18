import { createClient } from '@/lib/supabase/client'

type SupabaseBrowserClient = ReturnType<typeof createClient>

export async function getPostLoginRedirect(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return '/onboarding/role'
  return profile.role === 'cook' ? '/requests' : '/swipe'
}
