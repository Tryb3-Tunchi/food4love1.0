// No imports on purpose: unit-tested with `node --test`, and shared by the interest API
// route, the booking panel and the verification email/notification so the wording lives in
// ONE place.

// What the customer sees right after pressing "Notify me when verified".
export const INTEREST_SAVED_MESSAGE =
  "You're on the list! ❤️ We'll notify you as soon as this cook completes verification and becomes available for bookings."

export const INTEREST_DUPLICATE_MESSAGE =
  "You've already requested to be notified about this cook. We'll let you know when they're verified."

export const INTEREST_FAILED_MESSAGE =
  "We couldn't save your request right now. Please try again."

// The in-app notification sent when a cook becomes verified. The database trigger writes
// the same text (see supabase-migration-interest-verification-email.sql); a test keeps
// the two from drifting apart.
export const INTEREST_AVAILABLE_TITLE = 'Good news! ❤️'
export const INTEREST_AVAILABLE_BODY =
  'The cook you were interested in has completed Food4Love verification and is now eligible to receive booking requests. You can visit their profile and make a booking.'
