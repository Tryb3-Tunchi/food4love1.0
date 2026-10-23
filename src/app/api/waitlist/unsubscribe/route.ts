import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const tokenSchema = z.string().uuid()

function confirmationPage(success: boolean) {
  const title = success ? 'You are unsubscribed' : 'Link unavailable'
  const message = success
    ? 'Food4Love marketing emails have been turned off for this address.'
    : 'This unsubscribe link is invalid or has expired. No account changes were made.'

  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Food4Love</title><body style="margin:0;background:#fffaf4;color:#2f211b;font:16px/1.6 Arial,sans-serif"><main style="max-width:560px;margin:12vh auto;padding:32px"><p style="color:#4b8b57;font-weight:700">Food4Love</p><h1>${title}</h1><p>${message}</p></main></body></html>`,
    {
      status: success ? 200 : 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

async function unsubscribe(token: string | null) {
  const parsedToken = tokenSchema.safeParse(token)
  if (!parsedToken.success) return false

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('waitlist_subscribers')
    .update({
      updates_consent: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', parsedToken.data)
    .select('id')
    .maybeSingle()

  return !error && !!data
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  return confirmationPage(await unsubscribe(token))
}

export async function POST(request: Request) {
  const urlToken = new URL(request.url).searchParams.get('token')
  if (urlToken) return confirmationPage(await unsubscribe(urlToken))

  const formData = await request.formData().catch(() => null)
  const token = formData?.get('token')
  return confirmationPage(
    await unsubscribe(typeof token === 'string' ? token : null),
  )
}
