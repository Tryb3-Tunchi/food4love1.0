import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLimiter } from '@/lib/rateLimit'
import { csvRow } from '@/lib/admin/intelligence/privacy'
import { ROW_CAP } from '@/lib/admin/intelligence/server/core'
import {
  exportWaitlistRows,
  filtersFromParams,
} from '@/lib/admin/intelligence/server/waitlist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A waitlist export is a bulk copy of personal data, so it is rare, audited and
// rate limited per administrator. (The limit is per server instance, so it is a
// brake on mistakes, not a hard guarantee.)
const allow = createLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('waitlist:export')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!allow(actor.id)) {
    return NextResponse.json(
      { error: 'Too many exports. Please wait a few minutes.' },
      { status: 429 },
    )
  }

  const filters = filtersFromParams(request.nextUrl.searchParams)

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'The server is not configured to export data.' },
      { status: 503 },
    )
  }

  // 1) Read the rows INTO MEMORY first. Nothing has left the server yet.
  let rows: Awaited<ReturnType<typeof exportWaitlistRows>>
  try {
    rows = await exportWaitlistRows(admin, filters, ROW_CAP + 1)
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
  const truncated = rows.length > ROW_CAP
  if (truncated) rows = rows.slice(0, ROW_CAP)

  // 2) Record the export, including HOW MANY people it contains, before sending
  // anything. If the audit log is unavailable the data is not released.
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'waitlist.export_csv',
    targetType: 'waitlist_export',
    targetId: actor.id,
    details: { filters, row_count: rows.length, truncated },
  }).catch(() => null)
  if (!audit) {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  const lines = [
    csvRow([
      'email',
      'joined_at',
      'audience',
      'source',
      'marketing_consent',
      'consent_recorded_at',
      'confirmation_email_sent',
      'unsubscribed',
      'safe_to_market_to',
    ]),
    ...rows.map((r) =>
      csvRow([
        r.email,
        r.created_at,
        r.audience,
        r.source,
        r.updates_consent === true ? 'yes' : 'no',
        r.consent_at,
        r.confirmation_sent_at ? 'yes' : 'no',
        r.unsubscribed_at ? 'yes' : 'no',
        r.updates_consent === true && !r.unsubscribed_at ? 'yes' : 'no',
      ]),
    ),
  ]
  await finishAdminAudit(audit.admin, audit.auditId, 'succeeded').catch(
    () => undefined,
  )
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="food4love-waitlist-${stamp}.csv"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(rows.length),
      'X-Export-Truncated': String(truncated),
    },
  })
}
