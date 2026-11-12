// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  resolveRange,
  startOfAdminDay,
  windowStart,
} from '../src/lib/admin/intelligence/dateRange.ts'
import {
  bucketCounts,
  bucketDistinct,
  growthPercent,
  ratePercent,
  buildFunnel,
  okMetric,
  unavailable,
} from '../src/lib/admin/intelligence/series.ts'
import {
  ADMIN_ROLES,
  ALL_PERMISSIONS,
  holdsPermission,
  isAdminPermission,
  roleForPermissions,
} from '../src/lib/admin/intelligence/permissions.ts'
import {
  maskEmail,
  normalizeEmailForDuplicates,
  csvCell,
  cleanTag,
  cleanPath,
} from '../src/lib/admin/intelligence/privacy.ts'
import { classifyChannel } from '../src/lib/admin/intelligence/attribution.ts'
import {
  presenceBand,
  summarisePresence,
} from '../src/lib/admin/intelligence/presence.ts'
import { verifySvixSignature } from '../src/lib/admin/intelligence/webhookSignature.ts'

// 2026-11-12 15:30 UTC = 16:30 in Lagos (UTC+1)
const NOW = Date.parse('2026-11-12T15:30:00Z')

test('"today" starts at Lagos midnight, not UTC midnight', () => {
  assert.equal(
    new Date(startOfAdminDay(NOW)).toISOString(),
    '2026-11-11T23:00:00.000Z',
  )
  // 23:30 UTC is already the next day in Lagos
  const lateUtc = Date.parse('2026-11-12T23:30:00Z')
  assert.equal(
    new Date(startOfAdminDay(lateUtc)).toISOString(),
    '2026-11-12T23:00:00.000Z',
  )
})

test('today compares with yesterday up to the same time', () => {
  const r = resolveRange({ range: 'today' }, NOW)
  assert.equal(r.from, '2026-11-11T23:00:00.000Z')
  assert.equal(r.to, '2026-11-12T15:30:00.000Z')
  assert.equal(r.prevFrom, '2026-11-10T23:00:00.000Z')
  assert.equal(r.prevTo, '2026-11-11T15:30:00.000Z')
  assert.equal(r.bucket, 'hour')
})

test('yesterday and rolling ranges are day-aligned with equal-length previous periods', () => {
  const y = resolveRange({ range: 'yesterday' }, NOW)
  assert.equal(y.from, '2026-11-10T23:00:00.000Z')
  assert.equal(y.to, '2026-11-11T23:00:00.000Z')
  assert.equal(y.prevFrom, '2026-11-09T23:00:00.000Z')

  const week = resolveRange({ range: '7d' }, NOW)
  assert.equal(week.from, '2026-11-05T23:00:00.000Z') // 6 days before today
  const len = Date.parse(week.to) - Date.parse(week.from)
  assert.equal(Date.parse(week.prevTo) - Date.parse(week.prevFrom), len)
  assert.equal(week.bucket, 'day')
  assert.equal(resolveRange({ range: '90d' }, NOW).bucket, 'day')
})

test('year starts on 1 January Lagos time and uses weekly buckets', () => {
  const r = resolveRange({ range: 'year' }, NOW)
  assert.equal(r.from, '2025-12-31T23:00:00.000Z')
  assert.equal(r.bucket, 'week')
})

test('custom range: valid dates are honoured, bad input falls back to 30 days', () => {
  const ok = resolveRange(
    { range: 'custom', from: '2026-11-01', to: '2026-11-10' },
    NOW,
  )
  assert.equal(ok.preset, 'custom')
  assert.equal(ok.from, '2026-10-31T23:00:00.000Z')
  assert.equal(ok.to, '2026-11-10T23:00:00.000Z')

  for (const bad of [
    { range: 'custom', from: '2026-11-10', to: '2026-11-01' }, // reversed
    { range: 'custom', from: '2026-11-01', to: '2027-01-01' }, // future
    { range: 'custom', from: '2024-01-01', to: '2026-11-10' }, // > 400 days
    { range: 'custom', from: 'nonsense', to: '2026-11-10' },
    { range: 'custom', from: '2026-02-31', to: '2026-03-02' }, // impossible date
    { range: 'evil' },
    {},
  ]) {
    const r = resolveRange(bad, NOW)
    assert.equal(r.preset === 'custom' ? 'custom' : r.preset, r.preset)
    if (bad.range === 'custom') assert.equal(r.preset, '30d')
  }
})

test('week and month windows are relative to now', () => {
  assert.equal(
    new Date(windowStart('today', NOW)).toISOString(),
    '2026-11-11T23:00:00.000Z',
  )
  assert.equal(
    new Date(windowStart('week', NOW)).toISOString(),
    '2026-11-05T23:00:00.000Z',
  )
  assert.equal(
    new Date(windowStart('month', NOW)).toISOString(),
    '2026-10-13T23:00:00.000Z', // 14 Oct 00:00 in Lagos
  )
})

test('bucketCounts zero-fills and ignores timestamps outside the range', () => {
  const range = {
    from: '2026-11-09T23:00:00.000Z', // 10 Nov Lagos midnight
    to: '2026-11-12T23:00:00.000Z',
    bucket: 'day',
  }
  const points = bucketCounts(
    [
      '2026-11-10T10:00:00Z', // day 0
      '2026-11-10T22:59:00Z', // still day 0 (23:59 Lagos)
      '2026-11-11T08:00:00Z', // day 1
      '2026-11-09T22:59:00Z', // before the range
      '2026-11-12T23:00:00Z', // exactly the (exclusive) end
      'not a date',
    ],
    range,
  )
  assert.deepEqual(
    points.map((p) => p.v),
    [2, 1, 0],
  )
})

test('bucketDistinct counts each person once per bucket', () => {
  const range = {
    from: '2026-11-09T23:00:00.000Z',
    to: '2026-11-11T23:00:00.000Z',
    bucket: 'day',
  }
  const points = bucketDistinct(
    [
      { t: '2026-11-10T08:00:00Z', id: 'a' },
      { t: '2026-11-10T09:00:00Z', id: 'a' },
      { t: '2026-11-10T09:30:00Z', id: 'b' },
      { t: '2026-11-11T09:00:00Z', id: 'a' },
    ],
    range,
  )
  assert.deepEqual(
    points.map((p) => p.v),
    [2, 1],
  )
})

test('growth never produces Infinity or NaN', () => {
  assert.equal(growthPercent(150, 100), 50)
  assert.equal(growthPercent(50, 100), -50)
  assert.equal(growthPercent(5, 0), null)
  assert.equal(growthPercent(0, 0), null)
  assert.equal(growthPercent(NaN, 3), null)
  assert.equal(ratePercent(1, 3), 33.3)
  assert.equal(ratePercent(1, 0), null)
})

test('metrics distinguish "unavailable" from zero', () => {
  const real = okMetric(0, 4, [])
  assert.equal(real.status, 'ok')
  assert.equal(real.value, 0)
  assert.equal(real.growth, -100)
  const none = unavailable('Not collected yet')
  assert.equal(none.status, 'unavailable')
  assert.equal('value' in none, false)
})

test('funnel skips unmeasurable steps instead of inventing numbers', () => {
  const rows = buildFunnel([
    { key: 'visit', label: 'Visitors', count: null },
    { key: 'signup', label: 'Accounts', count: 40 },
    { key: 'profile', label: 'Profile complete', count: 30 },
    { key: 'match', label: 'First match', count: 3 },
  ])
  assert.equal(rows[0].percentOfFirst, null)
  assert.equal(rows[1].percentOfFirst, 100)
  assert.equal(rows[1].percentOfPrevious, null)
  assert.equal(rows[2].percentOfPrevious, 75)
  assert.equal(rows[3].percentOfFirst, 7.5)
})

test('Super Admin implies the new permissions; the old ones stay exact', () => {
  const owner = ['admin:manage', 'users:manage']
  assert.equal(holdsPermission(owner, 'analytics:view'), true)
  assert.equal(holdsPermission(owner, 'waitlist:export'), true)
  assert.equal(holdsPermission(owner, 'users:manage'), true)
  // admin:manage does NOT silently grant legacy powers it did not have before
  assert.equal(holdsPermission(owner, 'finance:refund'), false)
  assert.equal(holdsPermission(owner, 'kyc:review'), false)
  assert.equal(holdsPermission([], 'analytics:view'), false)
})

test('role presets: analytics viewers cannot act; only super admins manage access', () => {
  const viewer = ADMIN_ROLES.analytics_viewer.permissions
  assert.deepEqual(viewer, ['analytics:view'])
  for (const p of [
    'users:manage',
    'waitlist:export',
    'users:view_email',
    'admin:manage',
    'finance:refund',
  ]) {
    assert.equal(holdsPermission(viewer, p), false, `viewer must not hold ${p}`)
  }
  for (const [key, role] of Object.entries(ADMIN_ROLES)) {
    if (key === 'super_admin') continue
    assert.equal(
      role.permissions.includes('admin:manage'),
      false,
      `${key} must not be able to change staff access`,
    )
    assert.equal(
      role.permissions.includes('finance:refund'),
      false,
      `${key} must not move money`,
    )
  }
  assert.equal(
    ADMIN_ROLES.super_admin.permissions.length,
    ALL_PERMISSIONS.length,
  )
})

test('roleForPermissions recognises presets and rejects look-alikes', () => {
  assert.equal(
    roleForPermissions(ADMIN_ROLES.support_admin.permissions),
    'support_admin',
  )
  assert.equal(roleForPermissions(['analytics:view', 'users:manage']), null)
  assert.equal(isAdminPermission('analytics:view'), true)
  assert.equal(isAdminPermission('root'), false)
  assert.equal(isAdminPermission(5), false)
})

test('email masking and duplicate detection', () => {
  assert.equal(maskEmail('ada.obi@example.com'), 'a***@e*****.com')
  assert.equal(maskEmail(null), '—')
  assert.equal(maskEmail('nope'), '—')
  assert.equal(
    normalizeEmailForDuplicates('Ada.Obi+promo@Gmail.com'),
    'adaobi@gmail.com',
  )
  assert.equal(
    normalizeEmailForDuplicates('adaobi@googlemail.com'),
    'adaobi@gmail.com',
  )
  assert.equal(
    normalizeEmailForDuplicates('a.b+x@company.ng'),
    'a.b@company.ng',
  )
})

test('CSV export neutralises spreadsheet formulas and quotes', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+234'), `"'+234"`)
  assert.equal(csvCell('-1'), `"'-1"`)
  assert.equal(csvCell('@cmd'), `"'@cmd"`)
  assert.equal(csvCell('plain, with "quotes"'), `"plain, with ""quotes"""`)
  assert.equal(csvCell(null), '""')
  assert.equal(csvCell(42), '"42"')
})

test('analytics inputs are sanitised: tags short and plain, paths without queries', () => {
  assert.equal(cleanTag('Instagram'), 'instagram')
  assert.equal(cleanTag('spring_launch-1'), 'spring_launch-1')
  assert.equal(cleanTag('<script>'), null)
  assert.equal(cleanTag(7), null)
  assert.equal(cleanTag('a'.repeat(200))?.length, 64)
  assert.equal(cleanPath('/waitlist?token=secret#x'), '/waitlist')
  assert.equal(cleanPath('/cook/abc-123'), '/cook/abc-123')
  assert.equal(cleanPath('javascript:alert(1)'), null)
  assert.equal(cleanPath('//evil.com'), null)
  assert.equal(cleanPath(null), null)
})

test('traffic sources: tags win, then referral code, then the referring site', () => {
  const own = 'food4love.app'
  assert.equal(classifyChannel({ ownHost: own }), 'direct')
  assert.equal(classifyChannel({ utmSource: 'instagram' }), 'instagram')
  assert.equal(classifyChannel({ utmSource: 'IG' }), 'instagram')
  assert.equal(classifyChannel({ utmSource: 'twitter' }), 'x')
  assert.equal(classifyChannel({ utmSource: 'tiktok' }), 'tiktok')
  assert.equal(classifyChannel({ utmSource: 'newsletter' }), 'campaign')
  assert.equal(classifyChannel({ utmCampaign: 'launch' }), 'campaign')
  assert.equal(classifyChannel({ hasReferralCode: true }), 'referral')
  assert.equal(
    classifyChannel({ referrerHost: 'l.instagram.com' }),
    'instagram',
  )
  assert.equal(classifyChannel({ referrerHost: 'www.google.com.ng' }), 'google')
  assert.equal(classifyChannel({ referrerHost: 'www.google.com' }), 'google')
  assert.equal(classifyChannel({ referrerHost: 'blog.example.org' }), 'other')
  assert.equal(
    classifyChannel({ referrerHost: 'www.food4love.app', ownHost: own }),
    'direct',
  )
  // a deliberate tag beats the referrer
  assert.equal(
    classifyChannel({ utmSource: 'tiktok', referrerHost: 'www.google.com' }),
    'tiktok',
  )
})

test('online status expires by itself', () => {
  const today = NOW - 6 * 3_600_000
  const at = (secondsAgo) => NOW - secondsAgo * 1000
  assert.equal(presenceBand(at(30), NOW, today), 'online')
  assert.equal(presenceBand(at(119), NOW, today), 'online')
  assert.equal(presenceBand(at(121), NOW, today), '5m')
  assert.equal(presenceBand(at(600), NOW, today), '15m')
  assert.equal(presenceBand(at(1800), NOW, today), '1h')
  assert.equal(presenceBand(at(3 * 3600), NOW, today), 'today')
  assert.equal(presenceBand(at(8 * 3600), NOW, today), 'earlier')

  const counts = summarisePresence(
    [at(10), at(200), at(700), at(2000), at(3 * 3600), at(9 * 3600)],
    NOW,
    today,
  )
  assert.deepEqual(counts, {
    online: 1,
    last5m: 2,
    last15m: 3,
    lastHour: 4,
    today: 5,
  })
})

test('webhook signature: accepts the real signature, rejects tampering and replays', () => {
  const secretBytes = Buffer.from('super-secret-key-material')
  const secret = `whsec_${secretBytes.toString('base64')}`
  const body = JSON.stringify({
    type: 'email.bounced',
    data: { email_id: 'x' },
  })
  const id = 'msg_123'
  const ts = String(Math.floor(NOW / 1000))
  const sig = createHmac('sha256', secretBytes)
    .update(`${id}.${ts}.${body}`)
    .digest('base64')
  const good = {
    id,
    timestamp: ts,
    signatureHeader: `v1,${sig}`,
    body,
    secret,
    nowMs: NOW,
  }
  assert.equal(verifySvixSignature(good), true)
  assert.equal(
    verifySvixSignature({ ...good, signatureHeader: `v1,bogus v1,${sig}` }),
    true,
    'any matching v1 signature in the list is enough',
  )
  assert.equal(verifySvixSignature({ ...good, body: body + ' ' }), false)
  assert.equal(
    verifySvixSignature({ ...good, signatureHeader: `v1,${sig.slice(2)}AA` }),
    false,
  )
  assert.equal(verifySvixSignature({ ...good, secret: 'whsec_AAAA' }), false)
  assert.equal(
    verifySvixSignature({ ...good, nowMs: NOW + 10 * 60 * 1000 }),
    false,
    'a captured request cannot be replayed later',
  )
  assert.equal(verifySvixSignature({ ...good, id: null }), false)
  assert.equal(verifySvixSignature({ ...good, secret: '' }), false)
})
