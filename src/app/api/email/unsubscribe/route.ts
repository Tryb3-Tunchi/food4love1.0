import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const responseHtml = (message: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Food4Love email preferences</title></head><body style="margin:0;background:#fffaf4;color:#2f211b;font:16px/1.6 Arial,sans-serif;padding:32px"><main style="box-sizing:border-box;max-width:520px;margin:10vh auto;background:#fff;border:1px solid #eee2d6;border-radius:20px;padding:32px"><h1 style="font-size:24px">Food4Love email preferences</h1><p>${message}</p><a href="/" style="display:inline-block;margin-top:12px;color:#176044;font-weight:700">Return to Food4Love</a></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )

function confirmationHtml(token: string | null) {
  if (!token || token.length > 100)
    return responseHtml('This unsubscribe link is unavailable.', 400)
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Food4Love email preferences</title></head><body style="margin:0;background:#fffaf4;color:#2f211b;font:16px/1.6 Arial,sans-serif;padding:32px"><main style="box-sizing:border-box;max-width:520px;margin:10vh auto;background:#fff;border:1px solid #eee2d6;border-radius:20px;padding:32px"><h1 style="font-size:24px">Turn off email updates?</h1><p>Confirm to stop Food4Love product and launch emails for this address.</p><form method="post" action="/api/email/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit" style="min-height:44px;border:0;border-radius:10px;background:#176044;color:#fff;padding:0 18px;font-weight:700">Unsubscribe</button></form></main></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

async function unsubscribe(token: string | null) {
  if (!token || token.length > 100) return false
  const admin = createAdminClient()
  const { data: record, error } = await admin
    .from('admin_email_unsubscribe_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  if (error || !record) return false

  const { error: updateError } = await admin
    .from('profiles')
    .update({ email_updates_consent: false, email_updates_consent_at: null })
    .eq('id', record.user_id)
  return !updateError
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  return confirmationHtml(token)
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const success = await unsubscribe(token)
  return success
    ? new NextResponse(null, { status: 200 })
    : new NextResponse(null, { status: 400 })
}
