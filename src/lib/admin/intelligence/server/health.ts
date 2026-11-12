import 'server-only'
import { fetchRows, headCount, type Admin } from './core'

type State = 'ok' | 'warn' | 'down' | 'unknown'
const DAY = 24 * 3600 * 1000
const has = (name: string) => Boolean(process.env[name]?.trim())

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; value?: T }> {
  const start = Date.now()
  try {
    const value = await fn()
    return { ok: true, ms: Date.now() - start, value }
  } catch {
    return { ok: false, ms: Date.now() - start }
  }
}

function latencyState(ok: boolean, ms: number): State {
  if (!ok) return 'down'
  return ms > 2000 ? 'warn' : 'ok'
}

export async function getHealth(admin: Admin) {
  const [db, auth, storage] = await Promise.all([
    timed(() => headCount(admin, 'profiles')),
    timed(async () => {
      const { error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      })
      if (error) throw error
    }),
    timed(async () => {
      const { data, error } = await admin.storage.listBuckets()
      if (error) throw error
      return data?.length ?? 0
    }),
  ])

  const checks = [
    {
      key: 'application',
      label: 'Application',
      state: 'ok' as State,
      detail: 'This page was served, so the application is running.',
    },
    {
      key: 'database',
      label: 'Supabase database',
      state: latencyState(db.ok, db.ms),
      detail: db.ok
        ? `Answered in ${db.ms} ms.`
        : 'The database did not answer.',
    },
    {
      key: 'auth',
      label: 'Supabase authentication',
      state: latencyState(auth.ok, auth.ms),
      detail: auth.ok
        ? `Answered in ${auth.ms} ms.`
        : 'The auth service did not answer.',
    },
    {
      key: 'storage',
      label: 'Supabase storage',
      state: latencyState(storage.ok, storage.ms),
      detail: storage.ok
        ? `${storage.value ?? 0} storage bucket(s) reachable (${storage.ms} ms). Used space is shown in the Supabase dashboard.`
        : 'Storage did not answer.',
    },
    {
      key: 'realtime',
      label: 'Supabase Realtime',
      state: 'unknown' as State,
      detail:
        'Tested from your browser when this page opens (see the Realtime check on this page).',
    },
  ]

  // Names only. Values are never read into the response.
  const config = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'RESEND_WEBHOOK_SECRET',
    'PAYSTACK_SECRET_KEY',
    'NEXT_PUBLIC_APP_URL',
  ].map((name) => ({ name, set: has(name) }))

  const deployment = {
    environment: process.env.VERCEL_ENV ?? 'local',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    region: process.env.VERCEL_REGION ?? null,
  }

  // Which optional tables exist yet? (Tells the owner what is still to apply.)
  const probes = [
    ['analytics_sessions', 'Visitor analytics'],
    ['analytics_events', 'Event tracking'],
    ['user_presence', 'Online presence'],
    ['ops_events', 'Operational events'],
    ['email_events', 'Email event history'],
    ['email_deliveries', 'Email delivery tracking'],
    ['admin_audit_log', 'Audit log'],
  ] as const
  const migrations = await Promise.all(
    probes.map(async ([table, label]) => ({
      table,
      label,
      applied: await headCount(admin, table)
        .then(() => true)
        .catch(() => false),
    })),
  )

  let events: {
    id: number
    created_at: string
    severity: string
    service: string
    code: string | null
    summary: string
  }[] = []
  let severityCounts: Record<string, number> | null = null
  try {
    const rows = await fetchRows<(typeof events)[number]>(
      admin,
      'ops_events',
      'id, created_at, severity, service, code, summary',
      { cap: 50 },
    )
    events = rows.rows
    const recent = rows.rows.filter(
      (e) => Date.parse(e.created_at) > Date.now() - DAY,
    )
    severityCounts = { info: 0, warning: 0, error: 0, critical: 0 }
    recent.forEach(
      (e) =>
        (severityCounts![e.severity] = (severityCounts![e.severity] ?? 0) + 1),
    )
  } catch {
    events = []
    severityCounts = null
  }

  return {
    checks,
    config,
    deployment,
    migrations,
    events,
    severityCounts,
    notMeasured: [
      {
        label: 'Failed requests and error rates',
        reason:
          'Recorded by Vercel, not by the app. See the project’s Logs in Vercel.',
      },
      {
        label: 'Database size and query performance',
        reason: 'Shown in the Supabase dashboard under Reports and Database.',
      },
      {
        label: 'Authentication error history',
        reason: 'Available in the Supabase dashboard under Logs.',
      },
      {
        label: 'Background jobs',
        reason: 'Food4Love does not run scheduled background jobs yet.',
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}
