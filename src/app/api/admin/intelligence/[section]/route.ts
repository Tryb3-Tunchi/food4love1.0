import { NextRequest, NextResponse } from 'next/server'
import { adminPermissionsOf, getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  holdsPermission,
  type AdminPermission,
} from '@/lib/admin/intelligence/permissions'
import { resolveRange } from '@/lib/admin/intelligence/dateRange'
import { getOverview } from '@/lib/admin/intelligence/server/overview'
import { getLive } from '@/lib/admin/intelligence/server/live'
import {
  getAcquisition,
  getGeography,
  getVisitors,
} from '@/lib/admin/intelligence/server/traffic'
import {
  getEngagement,
  getRetention,
} from '@/lib/admin/intelligence/server/engagement'
import {
  getConversations,
  getCooks,
} from '@/lib/admin/intelligence/server/operations'
import { getEmailOps } from '@/lib/admin/intelligence/server/email'
import { getHealth } from '@/lib/admin/intelligence/server/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Each section needs its own permission. Checked here, on the server, for every
// request; hiding a menu item in the browser is never the protection.
const REQUIRED: Record<string, AdminPermission> = {
  overview: 'analytics:view',
  live: 'analytics:view',
  visitors: 'analytics:view',
  geography: 'analytics:view',
  acquisition: 'analytics:view',
  engagement: 'analytics:view',
  retention: 'analytics:view',
  cooks: 'analytics:view',
  conversations: 'analytics:view',
  email: 'email:manage',
  health: 'system:view',
}

// A short per-instance cache protects the database from refresh bursts.
const CACHE_MS = 30_000
const cache = new Map<string, { at: number; body: unknown }>()

export async function GET(
  request: NextRequest,
  { params }: { params: { section: string } },
) {
  const section = params.section
  // Own keys only, so inherited names such as "constructor" are plain 404s.
  const needed = Object.prototype.hasOwnProperty.call(REQUIRED, section)
    ? REQUIRED[section]
    : undefined
  if (!needed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const actor = await getAdminUser(needed)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams
  const range = resolveRange({
    range: search.get('range'),
    from: search.get('from'),
    to: search.get('to'),
  })
  const country = /^[A-Za-z]{2}$|^\?\?$/.test(search.get('country') ?? '')
    ? (search.get('country') as string).toUpperCase()
    : null

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'The server is not configured to read admin data.' },
      { status: 503 },
    )
  }

  const canSeePeople = holdsPermission(
    adminPermissionsOf(actor),
    'presence:view',
  )
  const key = [section, range.preset, range.from, range.to, country].join('|')
  const cacheable = section !== 'live'
  const hit = cacheable ? cache.get(key) : undefined
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json(hit.body, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    let body: unknown
    switch (section) {
      case 'overview':
        body = await getOverview(admin, range)
        break
      case 'live':
        body = await getLive(admin, canSeePeople)
        break
      case 'visitors':
        body = await getVisitors(admin, range)
        break
      case 'geography':
        body = await getGeography(admin, range, country)
        break
      case 'acquisition':
        body = await getAcquisition(admin, range)
        break
      case 'engagement':
        body = await getEngagement(admin, range)
        break
      case 'retention':
        body = await getRetention(admin)
        break
      case 'cooks':
        body = await getCooks(admin, range)
        break
      case 'conversations':
        body = await getConversations(admin, range)
        break
      case 'email':
        body = await getEmailOps(admin)
        break
      default:
        body = await getHealth(admin)
    }
    if (cacheable) cache.set(key, { at: Date.now(), body })
    if (cache.size > 200) cache.clear()
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'Could not load this section right now.' },
      { status: 500 },
    )
  }
}
