// No imports on purpose: unit-tested with `node --test`, shared by the form and the
// server so the price and the required fields can never drift apart.

export const SERVICE_TYPES = ['private_cooking', 'delivery', 'pickup'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_LABELS: Record<ServiceType, string> = {
  private_cooking: 'Cook at my place',
  delivery: 'Delivery',
  pickup: 'I will collect it',
}

export const SERVICE_HELP: Record<ServiceType, string> = {
  private_cooking:
    'The cook comes to the address you give and prepares the meal there.',
  delivery:
    'The food is brought to the address you give. Food4Love does not run deliveries: the cook arranges how it gets to you.',
  pickup: 'You collect the food from the cook. The cook will tell you where.',
}

// Only some service types need an address from the customer.
export function needsAddress(type: ServiceType): boolean {
  return type === 'private_cooking' || type === 'delivery'
}

// Fees. The 5% service fee and the 500 Naira delivery fee are the amounts the booking
// route already charged; the delivery fee now applies only to deliveries, because
// collecting or being cooked for at home involves no delivery. (Business rule to confirm.)
export const DELIVERY_FEE = 500
export const SERVICE_FEE_RATE = 0.05

export function deliveryFeeFor(type: ServiceType): number {
  return type === 'delivery' ? DELIVERY_FEE : 0
}

export function serviceFeeFor(subtotal: number): number {
  return Math.round(subtotal * SERVICE_FEE_RATE)
}

export function totalFor(subtotal: number, type: ServiceType): number {
  return subtotal + deliveryFeeFor(type) + serviceFeeFor(subtotal)
}

export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'No pork',
  'Gluten-free',
  'Dairy-free',
  'Low spice',
  'Extra spicy',
] as const

// Allergy information is sensitive and safety-critical, so the customer must state it
// either way: "none" or a description. It is never silently left blank.
export const NO_ALLERGIES = 'None declared'

export function allergyIsDeclared(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length >= 2
}

// Booking time rules (the cook's own weekly hours and notice period are checked
// separately against their availability).
export const MAX_DAYS_AHEAD = 180
export const MIN_LEAD_MINUTES = 60

export function validateSchedule(
  when: Date,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const time = when.getTime()
  if (Number.isNaN(time))
    return { ok: false, reason: 'Choose a valid date and time.' }
  if (time < now.getTime() + MIN_LEAD_MINUTES * 60_000)
    return { ok: false, reason: 'Choose a time at least an hour from now.' }
  if (time > now.getTime() + MAX_DAYS_AHEAD * 86_400_000)
    return {
      ok: false,
      reason: `Choose a date within the next ${MAX_DAYS_AHEAD} days.`,
    }
  return { ok: true }
}

// Where the "service address" is shown. Participants only; never in admin lists.
export function addressFor(
  type: ServiceType,
  address: string | null | undefined,
): string | null {
  if (!needsAddress(type)) return null
  const trimmed = (address ?? '').trim()
  return trimmed.length >= 8 ? trimmed : null
}
