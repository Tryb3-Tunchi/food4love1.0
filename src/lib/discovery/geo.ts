// Pure module with NO imports so it can be unit-tested with node --test.

// Members who opt in are stored as the CENTRE of a ~2 km grid cell, never an exact
// point. The database snaps before saving; this mirror is used for clustering,
// bounds checks and tests.
export const GRID_DEGREES = 0.02
export const MAX_SPAN_DEGREES = 1 // about 110 km: no whole-country sweeps

export function snapToGrid(value: number): number {
  return (
    Math.round(Math.round(value / GRID_DEGREES) * GRID_DEGREES * 10000) / 10000
  )
}

export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

// Validates and tidies the area the map is looking at. Returns null for anything
// that is not a sensible, finite, on-Earth rectangle; oversized areas are shrunk
// around their centre instead of being refused.
export function clampBounds(
  input: Partial<Record<keyof Bounds, unknown>>,
  maxSpan: number = MAX_SPAN_DEGREES,
): Bounds | null {
  const nums = [input.south, input.west, input.north, input.east]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n)))
    return null
  let { south, west, north, east } = input as Bounds
  if (south > north) [south, north] = [north, south]
  if (west > east) [west, east] = [east, west]
  if (south < -90 || north > 90 || west < -180 || east > 180) return null
  const clamp = (a: number, b: number) => {
    if (b - a <= maxSpan) return [a, b] as const
    const mid = (a + b) / 2
    return [mid - maxSpan / 2, mid + maxSpan / 2] as const
  }
  const [s, n] = clamp(south, north)
  const [w, e] = clamp(west, east)
  const r = (v: number) => Math.round(v * 10000) / 10000
  return { south: r(s), north: r(n), west: r(w), east: r(e) }
}

export interface MapProfile {
  id: string
  role: 'cook' | 'buyer'
  full_name: string | null
  avatar_url: string | null
  lat: number
  lng: number
}

// New pages of results are merged by id, so a member can never appear twice
// (two overlapping map views, a re-fetch, or a "load more" all return repeats).
export function mergeProfiles<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map<string, T>()
  for (const item of existing) byId.set(item.id, item)
  for (const item of incoming) byId.set(item.id, item)
  return Array.from(byId.values())
}

export interface Cluster<T> {
  key: string
  lat: number
  lng: number
  count: number
  members: T[]
}

// Groups nearby markers when zoomed out so the map stays readable and fast.
// Cells are about 64 screen pixels wide; at street zoom nothing is grouped.
export function clusterProfiles<
  T extends { id: string; lat: number; lng: number },
>(items: T[], zoom: number): Cluster<T>[] {
  if (zoom >= 15) {
    return items.map((m) => ({
      key: m.id,
      lat: m.lat,
      lng: m.lng,
      count: 1,
      members: [m],
    }))
  }
  const degreesPerPixel = 360 / (256 * Math.pow(2, Math.max(0, zoom)))
  const cell = degreesPerPixel * 64
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = `${Math.floor(item.lat / cell)}:${Math.floor(item.lng / cell)}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return Array.from(groups, ([key, members]) => {
    const lat = members.reduce((s, m) => s + m.lat, 0) / members.length
    const lng = members.reduce((s, m) => s + m.lng, 0) / members.length
    return {
      key: members.length === 1 ? members[0].id : `c:${key}`,
      lat,
      lng,
      count: members.length,
      members,
    }
  })
}

// "General location" shown to other members: only the LAST comma-separated part
// (for example "Lagos"). A part containing a digit (street number, postcode) is
// never shown. Mirrors the database function exactly.
export function generalArea(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parts = value.split(',')
  const last = (parts[parts.length - 1] ?? '').trim()
  if (!last || /[0-9]/.test(last)) return null
  return last.slice(0, 40)
}
