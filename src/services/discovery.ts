import { createClient } from '@/lib/supabase/client'
import type { Bounds } from '@/lib/discovery/geo'

// Everything the map may show about another member. These are the ONLY columns the
// database function returns: no email, no exact location, no coordinates other than
// the approximate, offset marker position.
export interface DiscoveryProfile {
  id: string
  role: 'cook' | 'buyer'
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  cuisines: string[] | null
  price_min: number | null
  rating: number | null
  review_count: number | null
  verified: boolean
  area_label: string | null
  lat: number
  lng: number
}

export const DISCOVERY_PAGE_SIZE = 100

// Thrown when the database upgrade that powers the map has not been applied yet.
export class DiscoveryUnavailableError extends Error {
  constructor() {
    super('Map discovery is not switched on yet')
    this.name = 'DiscoveryUnavailableError'
  }
}

function isMissingFunction(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|does not exist/i.test(error.message ?? '')
  )
}

export async function fetchDiscoveryPage(input: {
  bounds: Bounds
  roles: ('cook' | 'buyer')[] | null
  after?: string | null
}): Promise<DiscoveryProfile[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('discovery_profiles', {
    p_south: input.bounds.south,
    p_west: input.bounds.west,
    p_north: input.bounds.north,
    p_east: input.bounds.east,
    p_roles: input.roles,
    p_limit: DISCOVERY_PAGE_SIZE,
    p_after: input.after ?? null,
  })
  if (error) {
    if (isMissingFunction(error)) throw new DiscoveryUnavailableError()
    throw new Error(error.message)
  }
  return ((data ?? []) as DiscoveryProfile[]).filter(
    (row) =>
      typeof row.id === 'string' &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lng) &&
      (row.role === 'cook' || row.role === 'buyer'),
  )
}

export interface MyDiscovery {
  discoverable: boolean
  area_lat: number | null
  area_lng: number | null
  consent_at: string | null
}

// The member's own setting. Row-level security lets a member read only their own row.
export async function getMyDiscovery(): Promise<MyDiscovery | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('member_discovery')
    .select('discoverable, approx_lat, approx_lng, consent_at')
    .maybeSingle()
  if (error) {
    if (isMissingFunction(error) || error.code === '42P01')
      throw new DiscoveryUnavailableError()
    throw new Error(error.message)
  }
  if (!data)
    return {
      discoverable: false,
      area_lat: null,
      area_lng: null,
      consent_at: null,
    }
  return {
    discoverable: !!data.discoverable,
    area_lat: data.approx_lat,
    area_lng: data.approx_lng,
    consent_at: data.consent_at,
  }
}

// The device position is sent to the database function, which rounds it to a ~2 km
// area before saving. The exact point is never stored.
export async function setMyDiscovery(
  discoverable: boolean,
  position?: { lat: number; lng: number },
): Promise<MyDiscovery> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('set_my_discovery', {
    p_discoverable: discoverable,
    p_lat: discoverable ? (position?.lat ?? null) : null,
    p_lng: discoverable ? (position?.lng ?? null) : null,
  })
  if (error) {
    if (isMissingFunction(error)) throw new DiscoveryUnavailableError()
    throw new Error(error.message)
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    discoverable: !!row?.is_discoverable,
    area_lat: row?.area_lat ?? null,
    area_lng: row?.area_lng ?? null,
    consent_at: discoverable ? new Date().toISOString() : null,
  }
}
