import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingTable } from '@/lib/admin/ops'
import { createLimiter, clientKey } from '@/lib/rateLimit'
import { classifyChannel } from '@/lib/admin/intelligence/attribution'
import { cleanPath, cleanTag } from '@/lib/admin/intelligence/privacy'

// Public endpoint, so it is defensive: tiny bodies, a rate limit, an allow-list
// of event names, sanitised fields, and it ALWAYS answers quietly (204) so a
// problem here can never affect the website itself.

const allow = createLimiter({ limit: 90, windowMs: 60_000 })
const uuid = z.string().uuid()

const bodySchema = z.object({
  type: z.enum(['event', 'heartbeat']),
  name: z
    .enum([
      'page_view',
      'waitlist_signup',
      'signup_complete',
      'profile_complete',
      'cook_profile_view',
      'story_view',
      'story_save',
      'booking_request',
    ])
    .optional(),
  client_event_id: uuid.optional(),
  visitor_id: uuid,
  session_id: uuid,
  path: z.string().max(300).optional(),
  referrer_host: z.string().max(120).nullable().optional(),
  utm_source: z.string().max(80).nullable().optional(),
  utm_medium: z.string().max(80).nullable().optional(),
  utm_campaign: z.string().max(80).nullable().optional(),
  has_ref: z.boolean().optional(),
  is_returning: z.boolean().optional(),
  device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
})

const BOT = /bot|crawl|spider|headless|preview|lighthouse|monitor/i
const quiet = () => new NextResponse(null, { status: 204 })

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('x-f4l-consent') !== 'accepted') return quiet()
    if (!allow(clientKey(request.headers))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    // The user agent is read only to ignore crawlers; it is never stored.
    if (BOT.test(request.headers.get('user-agent') ?? '')) return quiet()

    const text = await request.text()
    if (text.length > 2048) return quiet()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return quiet()
    }
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return quiet()
    const body = parsed.data
    if (body.type === 'event' && (!body.name || !body.client_event_id)) {
      return quiet()
    }

    const path = cleanPath(body.path) ?? '/'
    // The platform supplies a coarse country/region from the connection. The IP
    // address itself is not read, kept or logged by this code.
    const countryRaw = request.headers.get('x-vercel-ip-country') ?? ''
    const regionRaw = request.headers.get('x-vercel-ip-country-region') ?? ''
    const country = /^[A-Za-z]{2}$/.test(countryRaw)
      ? countryRaw.toUpperCase()
      : null
    const region = /^[A-Za-z0-9-]{1,6}$/.test(regionRaw)
      ? regionRaw.toUpperCase()
      : null

    const utmSource = cleanTag(body.utm_source)
    const utmCampaign = cleanTag(body.utm_campaign)
    const utmMedium = cleanTag(body.utm_medium)
    const referrerHost = cleanTag(body.referrer_host, 120)
    const channel = classifyChannel({
      utmSource,
      utmCampaign,
      referrerHost,
      hasReferralCode: body.has_ref === true,
      ownHost: request.nextUrl.hostname,
    })

    // Attach the member id only when someone is actually signed in.
    let userId: string | null = null
    if (request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const created = await admin.from('analytics_sessions').upsert(
      {
        id: body.session_id,
        visitor_id: body.visitor_id,
        user_id: userId,
        started_at: now,
        last_seen_at: now,
        landing_path: path,
        referrer_host: referrerHost,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        channel,
        country,
        region,
        device: body.device ?? null,
        is_returning: body.is_returning === true,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (created.error) return quiet() // includes "migration not applied yet"

    // Existing session: just extend it (this is what measures session length).
    await admin
      .from('analytics_sessions')
      .update(
        userId ? { last_seen_at: now, user_id: userId } : { last_seen_at: now },
      )
      .eq('id', body.session_id)

    if (body.type === 'event' && body.name && body.client_event_id) {
      const inserted = await admin.from('analytics_events').upsert(
        {
          client_event_id: body.client_event_id,
          session_id: body.session_id,
          visitor_id: body.visitor_id,
          user_id: userId,
          name: body.name,
          path,
        },
        { onConflict: 'client_event_id', ignoreDuplicates: true },
      )
      if (inserted.error && !isMissingTable(inserted.error)) return quiet()
    }

    if (userId) {
      await admin
        .from('user_presence')
        .upsert(
          { user_id: userId, last_seen_at: now, path },
          { onConflict: 'user_id' },
        )
    }
    return quiet()
  } catch {
    return quiet()
  }
}
