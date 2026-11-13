// Pure module with NO imports so it can be unit-tested with node --test.

export interface MemberAccessFacts {
  viewerId: string | null | undefined
  targetId: string
  targetRole: string | null | undefined
  targetSuspended: boolean | null | undefined
  targetOnboarded: boolean | null | undefined
  // Any active (status "matched") match between the two people.
  matched: boolean
  // Either person has liked the other.
  likeRelationship: boolean
  // The target opted in to the discovery map.
  discoverable: boolean
}

export type MemberAccess =
  | { allowed: true; reason: 'self' | 'match' | 'like' | 'map' }
  | {
      allowed: false
      reason: 'signed_out' | 'unavailable' | 'wrong_role' | 'no_relationship'
    }

// Who may open a food lover's profile page (/member/<id>). Chefs have their own
// public page, so they are sent there instead. Everyone else must have a real
// reason to see the page: they matched, there is a like between them, or the
// person agreed to be discoverable on the map. A random id in the address bar
// therefore shows nothing, which also stops people being enumerated by id.
export function memberAccess(f: MemberAccessFacts): MemberAccess {
  if (!f.viewerId) return { allowed: false, reason: 'signed_out' }
  if (f.viewerId === f.targetId) return { allowed: true, reason: 'self' }
  if (f.targetSuspended || !f.targetOnboarded)
    return { allowed: false, reason: 'unavailable' }
  if (f.targetRole !== 'buyer') return { allowed: false, reason: 'wrong_role' }
  if (f.matched) return { allowed: true, reason: 'match' }
  if (f.likeRelationship) return { allowed: true, reason: 'like' }
  if (f.discoverable) return { allowed: true, reason: 'map' }
  return { allowed: false, reason: 'no_relationship' }
}
