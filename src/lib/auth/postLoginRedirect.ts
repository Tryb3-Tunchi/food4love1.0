import { createClient } from '@/lib/supabase/client'
import { safeNextPath } from '@/lib/safeRedirect'

type SupabaseBrowserClient = ReturnType<typeof createClient>

// `intended` is the page the person was on before being asked to sign in (the login link's
// ?next=). It is honoured only for a finished account, and only if it stays on this site
// (safeNextPath rejects anything else), so a crafted link cannot send anyone elsewhere.
export async function getPostLoginRedirect(
  supabase: SupabaseBrowserClient,
  userId: string,
  intended?: string | null,
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the signed-in profile', { cause: error })
  }

  if (!profile) return '/onboarding/role'
  if (profile.onboarding_complete !== true) return '/onboarding/setup'
  return safeNextPath(intended, '/swipe')
}
