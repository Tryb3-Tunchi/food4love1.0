// No imports on purpose: unit-tested with `node --test`.
//
// Which profile columns the browser may ask the database for.
//  - PUBLIC: what a profile card needs. Safe for any member to read about any other.
//  - PRIVATE: the member's own settings. Read only through get_my_private_profile()
//    (or directly, while the privacy migration has not been applied yet).
//  - NEVER: exact coordinates. No browser code reads them; the map uses the approximate,
//    opt-in discovery function instead.
// Writing select('*') on profiles from the browser is a bug: once the database revokes
// the private columns, '*' fails with "permission denied".

export const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'full_name',
  'avatar_url',
  'role',
  'bio',
  'location',
  'cuisines',
  'photos',
  'price_min',
  'price_max',
  'rating',
  'review_count',
  'is_verified',
  'suspended',
  'kyc_status',
  'created_at',
  'streak',
  'tour_completed',
  'onboarding_complete',
] as const

export const PRIVATE_PROFILE_COLUMNS = [
  'referral_code',
  'notification_preferences',
  'email_updates_consent',
  'email_updates_consent_at',
] as const

export const NEVER_REQUESTED_PROFILE_COLUMNS = ['lat', 'lng'] as const

export const PUBLIC_PROFILE_SELECT = PUBLIC_PROFILE_COLUMNS.join(', ')
export const PRIVATE_PROFILE_SELECT = PRIVATE_PROFILE_COLUMNS.join(', ')

export function touchesPrivateColumns(updates: object): boolean {
  return Object.keys(updates).some((key) =>
    (PRIVATE_PROFILE_COLUMNS as readonly string[]).includes(key),
  )
}
