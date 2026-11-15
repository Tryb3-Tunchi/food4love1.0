// No imports on purpose: unit-tested with `node --test`, and shared by the server
// routes and the screens so there is ONE definition of "who may take a booking".
//
// The authoritative signal is profiles.kyc_status. A member cannot change it from
// their own browser (a database trigger blocks it, and only the admin review route
// writes it), so it is safe to rely on. The "Verified" badge (is_verified) is only a
// display flag and is never used to decide anything.
//
// States map onto what the database already supports; nothing is invented:
//   kyc_status 'verified'          -> verified
//   kyc_status 'pending', or an open submission -> under_review
//   kyc_status 'rejected'          -> rejected
//   anything else                  -> not_verified
//   profiles.suspended = true      -> suspended (overrides everything)
// Expiry of a verification is NOT supported by the current database, so it is not
// modelled. Revocation is done by an administrator returning kyc_status to 'unverified'.

export type VerificationState =
  'verified' | 'under_review' | 'rejected' | 'not_verified' | 'suspended'

export interface CookRecord {
  role?: string | null
  kyc_status?: string | null
  suspended?: boolean | null
  onboarding_complete?: boolean | null
  // status of the cook's most recent verification submission, if any
  latest_submission?: 'pending' | 'approved' | 'rejected' | null
}

export function verificationState(cook: CookRecord): VerificationState {
  if (cook.suspended) return 'suspended'
  if (cook.kyc_status === 'verified') return 'verified'
  if (cook.kyc_status === 'pending' || cook.latest_submission === 'pending')
    return 'under_review'
  if (cook.kyc_status === 'rejected') return 'rejected'
  return 'not_verified'
}

export type BookableResult =
  | { ok: true }
  | {
      ok: false
      reason: 'not_a_cook' | 'onboarding_incomplete' | VerificationState
    }

// The single rule for "may this cook take a real booking right now".
export function cookBookable(
  cook: CookRecord | null | undefined,
): BookableResult {
  if (!cook || cook.role !== 'cook') return { ok: false, reason: 'not_a_cook' }
  const state = verificationState(cook)
  if (state !== 'verified') return { ok: false, reason: state }
  if (!cook.onboarding_complete)
    return { ok: false, reason: 'onboarding_incomplete' }
  return { ok: true }
}

// The wording the product owner specified for unverified cooks, kept in one place.
export const UNVERIFIED_COOK_MESSAGE =
  "This cook hasn't been verified by Food4Love yet. For your safety, bookings are temporarily unavailable. You can explore other verified cooks or ask us to notify you when this cook becomes available."

export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  verified: 'Verified',
  under_review: 'Verification under review',
  rejected: 'Not verified',
  not_verified: 'Not verified yet',
  suspended: 'Unavailable',
}

// Plain-language explanation shown to a customer looking at this cook.
export function customerExplanation(state: VerificationState): string {
  if (state === 'verified') return 'This cook is verified by Food4Love.'
  if (state === 'suspended')
    return 'This cook is not available for bookings right now.'
  return UNVERIFIED_COOK_MESSAGE
}

// Interest can be expressed only for a cook who cannot be booked yet and could become
// available. A suspended cook is excluded, and a bookable cook should simply be booked.
export function canExpressInterest(
  cook: CookRecord | null | undefined,
):
  | { ok: true }
  | { ok: false; reason: 'not_a_cook' | 'already_bookable' | 'suspended' } {
  if (!cook || cook.role !== 'cook') return { ok: false, reason: 'not_a_cook' }
  const state = verificationState(cook)
  if (state === 'suspended') return { ok: false, reason: 'suspended' }
  if (state === 'verified') return { ok: false, reason: 'already_bookable' }
  return { ok: true }
}
