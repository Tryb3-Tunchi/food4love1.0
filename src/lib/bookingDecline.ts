// Why a chef can give for declining a booking. The buyer gets one of these in
// the booking chat, so keep the labels polite and short.
export const DECLINE_KEYS = [
  'booked',
  'area',
  'price',
  'menu',
  'other',
] as const

export type DeclineReason = (typeof DECLINE_KEYS)[number]

export const DECLINE_LABELS: Record<DeclineReason, string> = {
  booked: 'Already booked that day',
  area: 'Outside my area',
  price: 'Amount too low for this menu',
  menu: 'Can’t cook that menu',
  other: 'Something came up',
}

export function declineMessage(reason: DeclineReason, note?: string | null) {
  const extra = note?.trim() ? ` ${note.trim()}` : ''
  return `Hi, thank you for the booking request. Unfortunately I can’t take it (${DECLINE_LABELS[reason].toLowerCase()}).${extra}`
}
