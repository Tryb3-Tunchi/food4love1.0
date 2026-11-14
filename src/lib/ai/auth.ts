import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createLimiter } from '@/lib/rateLimit'

export async function hasSignedInAiUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return Boolean(user)
}

// Each AI call costs money and sends the member's text to an outside provider, so
// signed-in members get a small per-minute allowance and a size cap on the request.
// (Per server instance: a brake on bursts, not an exact quota.)
const allow = createLimiter({ limit: 15, windowMs: 60_000 })
const MAX_BODY_BYTES = 100_000

export async function guardAiRequest(
  request: Request,
): Promise<Response | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request too large' }, { status: 413 })
  }
  if (!allow(user.id)) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
    )
  }
  return null
}
