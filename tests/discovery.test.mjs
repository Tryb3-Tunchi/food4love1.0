// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isUuid,
  profileHref,
  safeReturnPath,
  returnLabel,
} from '../src/lib/profileLinks.ts'
import {
  GRID_DEGREES,
  snapToGrid,
  clampBounds,
  mergeProfiles,
  clusterProfiles,
  generalArea,
} from '../src/lib/discovery/geo.ts'
import {
  buildActivity,
  pendingLikes,
  sentLikeState,
  dedupeById,
} from '../src/lib/matching/activity.ts'
import { memberAccess } from '../src/lib/matching/access.ts'
import {
  adminCreateAction,
  actionForExistingPair,
} from '../src/lib/matchRules.ts'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const A = '123e4567-e89b-42d3-a456-426614174000'
const B = '223e4567-e89b-42d3-a456-426614174001'
const MATCH = '323e4567-e89b-42d3-a456-426614174002'

// ------------------------------------------------------------ profile links
test('chefs open the chef page and other members open the member page', () => {
  assert.equal(profileHref({ id: A, role: 'cook' }), `/cook/${A}`)
  assert.equal(profileHref({ id: A, role: 'buyer' }), `/member/${A}`)
})

test('a broken row never produces a link to the wrong place', () => {
  for (const bad of [
    null,
    undefined,
    {},
    { id: 'abc', role: 'cook' },
    { id: '../admin', role: 'buyer' },
    { id: `${A}/../x`, role: 'cook' },
    { id: A, role: 'admin' },
    { id: A },
    { id: 5, role: 'cook' },
  ]) {
    assert.equal(profileHref(bad), null)
  }
  assert.equal(isUuid(A), true)
  assert.equal(isUuid(`${A} `), false)
})

test('"return to" links only ever point at known pages inside the app', () => {
  assert.equal(safeReturnPath('/matches'), '/matches')
  assert.equal(safeReturnPath('/matches?tab=received'), '/matches?tab=received')
  assert.equal(safeReturnPath(`/chat/${A}`), `/chat/${A}`)
  assert.equal(safeReturnPath('/map'), '/map')
  for (const bad of [
    'https://evil.example',
    '//evil.example',
    '/admin',
    '/matches?tab=../x',
    '/chat/not-an-id',
    `/chat/${A}/../../admin`,
    'javascript:alert(1)',
    '',
    null,
    7,
    '/map' + 'a'.repeat(100),
  ]) {
    assert.equal(safeReturnPath(bad), null, String(bad))
  }
  assert.equal(returnLabel(`/chat/${A}`), 'Back to the conversation')
  assert.equal(returnLabel('/matches?tab=sent'), 'Back to Matches')
  assert.equal(returnLabel(null), 'Back')
})

test('a profile link carries a safe return path and drops an unsafe one', () => {
  assert.equal(
    profileHref({ id: A, role: 'buyer' }, '/matches'),
    `/member/${A}?from=${encodeURIComponent('/matches')}`,
  )
  assert.equal(
    profileHref({ id: A, role: 'cook' }, 'https://evil.example'),
    `/cook/${A}`,
  )
})

// --------------------------------------------------------------- map geometry
test('locations snap to a ~2 km grid, so an exact point can never be stored', () => {
  assert.equal(GRID_DEGREES, 0.02)
  const exact = [6.452371, 3.394812]
  const snapped = exact.map(snapToGrid)
  assert.deepEqual(snapped, [6.46, 3.4])
  // two people a few hundred metres apart share a cell; nothing finer survives
  assert.equal(snapToGrid(6.4531), snapToGrid(6.4579))
  assert.notEqual(snapToGrid(6.4531), 6.4531)
  // the error is at most half a cell (~1.1 km)
  for (let i = 0; i < 500; i++) {
    const v = 6 + i * 0.00371
    assert.ok(Math.abs(snapToGrid(v) - v) <= GRID_DEGREES / 2 + 1e-9)
  }
})

test('map bounds: validated, ordered, and oversized areas are shrunk', () => {
  assert.deepEqual(
    clampBounds({ south: 6.4, west: 3.3, north: 6.6, east: 3.5 }),
    {
      south: 6.4,
      west: 3.3,
      north: 6.6,
      east: 3.5,
    },
  )
  // swapped corners are tidied
  assert.deepEqual(
    clampBounds({ south: 6.6, west: 3.5, north: 6.4, east: 3.3 }),
    {
      south: 6.4,
      west: 3.3,
      north: 6.6,
      east: 3.5,
    },
  )
  // a whole-country request is shrunk to the allowed span around its centre
  const big = clampBounds({ south: 4, west: 2, north: 14, east: 15 })
  assert.ok(big.north - big.south <= 1.0001 && big.east - big.west <= 1.0001)
  assert.ok(Math.abs((big.south + big.north) / 2 - 9) < 0.001)
  for (const bad of [
    {},
    { south: 'x', west: 0, north: 1, east: 1 },
    { south: NaN, west: 0, north: 1, east: 1 },
    { south: -91, west: 0, north: 1, east: 1 },
    { south: 0, west: 0, north: 91, east: 1 },
    { south: 0, west: -181, north: 1, east: 1 },
    { south: Infinity, west: 0, north: 1, east: 1 },
  ]) {
    assert.equal(clampBounds(bad), null)
  }
})

test('no duplicated map markers: pages merge by member id', () => {
  const first = [
    { id: 'a', n: 1 },
    { id: 'b', n: 1 },
  ]
  const second = [
    { id: 'b', n: 2 },
    { id: 'c', n: 2 },
  ]
  const merged = mergeProfiles(first, second)
  assert.deepEqual(merged.map((m) => m.id).sort(), ['a', 'b', 'c'])
  assert.equal(merged.find((m) => m.id === 'b').n, 2, 'newest data wins')
  assert.equal(mergeProfiles(merged, merged).length, 3, 'idempotent')
})

test('clustering groups nearby markers when zoomed out and splits them when zoomed in', () => {
  const items = [
    { id: 'a', lat: 6.45, lng: 3.39 },
    { id: 'b', lat: 6.451, lng: 3.391 },
    { id: 'c', lat: 6.452, lng: 3.392 },
    { id: 'far', lat: 9.07, lng: 7.4 },
  ]
  const out = clusterProfiles(items, 8)
  assert.equal(out.length, 2)
  const near = out.find((c) => c.count === 3)
  assert.ok(near, 'the three Lagos members form one cluster')
  assert.equal(near.members.length, 3)
  // total members are conserved at every zoom: nobody is lost or doubled
  for (const z of [3, 8, 12, 14, 15, 18]) {
    const total = clusterProfiles(items, z).reduce((s, c) => s + c.count, 0)
    assert.equal(total, items.length, `zoom ${z}`)
  }
  // street level: every member is its own marker with its own id as the key
  const street = clusterProfiles(items, 16)
  assert.equal(street.length, 4)
  assert.deepEqual(street.map((c) => c.key).sort(), ['a', 'b', 'c', 'far'])
  assert.equal(
    new Set(clusterProfiles(items, 8).map((c) => c.key)).size,
    2,
    'unique keys',
  )
})

// ----------------------------------------------------------- likes & matches
const person = (id, role = 'buyer', name = null) => ({
  id,
  role,
  full_name: name,
  avatar_url: null,
})

test('activity feed: newest first, one event per person, a match replaces the likes', () => {
  const events = buildActivity({
    received: [
      { created_at: '2026-11-10T09:00:00Z', person: person('p1') },
      { created_at: '2026-11-12T09:00:00Z', person: person('p2') },
    ],
    sent: [
      { created_at: '2026-11-11T09:00:00Z', person: person('p3', 'cook') },
      { created_at: '2026-11-09T09:00:00Z', person: person('p1') },
    ],
    matches: [
      { id: MATCH, created_at: '2026-11-13T09:00:00Z', person: person('p1') },
    ],
  })
  assert.deepEqual(
    events.map((e) => `${e.kind}:${e.person.id}`),
    ['match:p1', 'like_received:p2', 'like_sent:p3'],
  )
  for (let i = 1; i < events.length; i++) {
    assert.ok(Date.parse(events[i - 1].at) >= Date.parse(events[i].at))
  }
})

test('activity feed drops broken rows instead of rendering broken cards, and respects the limit', () => {
  const events = buildActivity({
    received: [
      { created_at: 'not a date', person: person('x') },
      { created_at: '2026-11-12T09:00:00Z', person: null },
      ...Array.from({ length: 30 }, (_, i) => ({
        created_at: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`,
        person: person(`u${i}`),
      })),
    ],
    sent: [],
    matches: [],
    limit: 10,
  })
  assert.equal(events.length, 10)
  assert.ok(events.every((e) => e.person && e.person.id.startsWith('u')))
})

test('likes received: only the unanswered ones, and a like state is matched or waiting', () => {
  const received = [
    { created_at: '2026-11-12T09:00:00Z', person: person('a') },
    { created_at: '2026-11-11T09:00:00Z', person: person('b') },
    { created_at: '2026-11-10T09:00:00Z', person: person('c') },
  ]
  assert.deepEqual(
    pendingLikes(received, ['b']).map((l) => l.person.id),
    ['a', 'c'],
  )
  assert.equal(sentLikeState('a', ['a', 'z']), 'matched')
  assert.equal(sentLikeState('q', ['a', 'z']), 'waiting')
  assert.equal(sentLikeState('q', []), 'waiting')
  assert.deepEqual(
    dedupeById([{ id: 1 }, { id: 2 }, { id: 1 }]).map((r) => r.id),
    [1, 2],
  )
})

test('only a general area is ever shown, never a street or a neighbourhood detail', () => {
  assert.equal(generalArea('Lekki Phase 1, Lagos'), 'Lagos')
  assert.equal(generalArea('Lagos'), 'Lagos')
  assert.equal(generalArea('  Abuja  '), 'Abuja')
  for (const bad of [
    '12 Admiralty Way',
    'Lagos, 101233',
    '',
    ',',
    null,
    undefined,
    7,
  ]) {
    assert.equal(generalArea(bad), null, String(bad))
  }
  assert.equal(generalArea('x, ' + 'a'.repeat(90)).length, 40)
})

test('who may open a food lover profile', () => {
  const base = {
    viewerId: A,
    targetId: B,
    targetRole: 'buyer',
    targetSuspended: false,
    targetOnboarded: true,
    matched: false,
    likeRelationship: false,
    discoverable: false,
  }
  assert.deepEqual(memberAccess(base), {
    allowed: false,
    reason: 'no_relationship',
  })
  assert.equal(memberAccess({ ...base, matched: true }).reason, 'match')
  assert.equal(memberAccess({ ...base, likeRelationship: true }).reason, 'like')
  assert.equal(memberAccess({ ...base, discoverable: true }).reason, 'map')
  assert.equal(memberAccess({ ...base, targetId: A }).reason, 'self')
  assert.equal(
    memberAccess({ ...base, viewerId: null, matched: true }).allowed,
    false,
  )
  // a relationship never overrides suspension or an unfinished profile
  assert.equal(
    memberAccess({ ...base, matched: true, targetSuspended: true }).reason,
    'unavailable',
  )
  assert.equal(
    memberAccess({ ...base, matched: true, targetOnboarded: false }).reason,
    'unavailable',
  )
  // chefs have their own page; this one is for food lovers only
  assert.equal(
    memberAccess({ ...base, targetRole: 'cook', matched: true }).reason,
    'wrong_role',
  )
  assert.equal(
    memberAccess({ ...base, targetRole: undefined, matched: true }).allowed,
    false,
  )
})

test('street-style location text is never shown as a general area', () => {
  for (const bad of [
    'Admiralty Way',
    'Lekki, Bode Thomas Street',
    'Ikeja, GRA Estate',
    'Plot Close',
    'Behind the market',
  ]) {
    assert.equal(generalArea(bad), null, bad)
  }
  // "st" inside a place name is not a street word
  assert.equal(generalArea('Lekki, Lagos'), 'Lagos')
  assert.equal(generalArea('Port Harcourt'), 'Port Harcourt')
  assert.equal(generalArea('Enugu'), 'Enugu')
  assert.equal(generalArea('Kaduna'), 'Kaduna')
})

test('admin-created matches reuse an older row for the pair instead of failing', () => {
  assert.equal(adminCreateAction(null), 'insert')
  assert.equal(adminCreateAction(undefined), 'insert')
  assert.equal(adminCreateAction('matched'), 'already_matched')
  for (const s of ['expired', 'pending', 'blocked'])
    assert.equal(adminCreateAction(s), 'reopen')
  // the swipe flow still never overrides a block
  assert.equal(actionForExistingPair('blocked'), 'blocked')
  assert.equal(actionForExistingPair('expired'), 'reopen')
})

test('no browser-side code reads exact profile coordinates any more', () => {
  const offenders = []
  const root = fileURLToPath(new URL('../src', import.meta.url))
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name)) {
        const text = readFileSync(full, 'utf8')
        // a select on the profiles table that names the lat column
        if (/from\('profiles'\)[\s\S]{0,400}?\.select\([^)]*\blat\b/.test(text))
          offenders.push(full)
      }
    }
  }
  walk(root)
  assert.deepEqual(offenders, [])
})
