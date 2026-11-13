import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingTable } from '@/lib/admin/ops'
import { createLimiter, clientKey } from '@/lib/rateLimit'
import { classifyChannel } from '@/lib/admin/intelligence/attribution'
import {
  cleanPath,
  cleanTag,
  isSameOrigin,
} from '@/lib/admin/intelligence/privacy'

// Public endpoint, so it is defensive: tiny bodies, a rate limit, an allow-list
// of event names, sanitised fields, and it ALWAYS answers quietly (204) so a
// problem here can never affect the website itself.

const allow = createLimiter({ limit: 90, windowMs: 60_000 }) // per address
const perSession = createLimiter({ limit: 30, windowMs: 60_000 })
const heartbeatGate = createLimiter({ limit: 1, windowMs: 30_000 })
// A last line of defence for the database: one server instance will not process
// more than this many analytics writes a minute, whoever is sending them.
const everyone = createLimiter({ limit: 1500, windowMs: 60_000 })
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
    // Off unless the owner switches collection on (see .env.example).
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true') return quiet()
    // A browser that sends Global Privacy Control has said no, so honour it.
    if (request.headers.get('sec-gpc') === '1') return quiet()
    // The browser only sends this after the visitor pressed Accept. The server
    // cannot PROVE consent, so this is a guard against accidental calls, not
    // against a determined forger.
    if (request.headers.get('x-f4l-consent') !== 'accepted') return quiet()
    // Real browsers always name the page's own site here. This stops OTHER
    // websites from making a visitor's browser post statistics to us.
    if (
      !isSameOrigin(request.headers.get('origin'), request.headers.get('host'))
    ) {
      return quiet()
    }
    if (Number(request.headers.get('content-length') ?? '0') > 2048) {
      return quiet()
    }
    if (!allow(clientKey(request.headers))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (!everyone('all')) return quiet()
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

    if (!perSession(body.session_id)) return quiet()
    if (body.type === 'heartbeat' && !heartbeatGate(body.session_id)) {
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

    const created = await admin
      .from('analytics_sessions')
      .upsert(
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
      .select('id')
    if (created.error) return quiet() // includes "migration not applied yet"

    // Only a session that already existed needs extending (that is what measures
    // session length). The visitor id must MATCH the one that started it, so
    // nobody can add events to, or stamp a member id onto, someone else's session.
    const isNewSession = (created.data?.length ?? 0) > 0
    if (!isNewSession) {
      let extend = admin
        .from('analytics_sessions')
        .update(
          userId
            ? { last_seen_at: now, user_id: userId }
            : { last_seen_at: now },
        )
        .eq('id', body.session_id)
        .eq('visitor_id', body.visitor_id)
      if (userId) extend = extend.or(`user_id.is.null,user_id.eq.${userId}`)
      const { data: owned, error: extendError } = await extend.select('id')
      if (extendError || !owned?.length) return quiet()
    }

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
