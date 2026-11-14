// No imports on purpose: unit-tested with `node --test`.

// ------------------------------------------------------------------ signup rules
export interface ExistingSubscriber {
  updates_consent: boolean | null
  unsubscribed_at: string | null
}

// What a repeat submission of the public form may change on an existing row.
//
// The form is open to anyone and does not prove ownership of the address, so it must
// never be able to:
//   * undo an unsubscribe (suppression is permanent until the person asks otherwise), or
//   * grant marketing consent on someone else's behalf for an address already on file.
// It MAY withdraw consent (the safe direction) and update the audience label.
// Returns null when nothing may change.
export function duplicateSignupUpdate(
  existing: ExistingSubscriber,
  input: { audience: 'food_lover' | 'cook'; updatesConsent: boolean },
): Record<string, unknown> | null {
  if (existing.unsubscribed_at) return null
  const update: Record<string, unknown> = { audience: input.audience }
  if (existing.updates_consent && !input.updatesConsent) {
    update.updates_consent = false
    update.consent_at = null
  }
  return update
}

// ------------------------------------------------------------- suppression events
// A permanent bounce or a spam complaint means this address must not receive marketing.
export function suppressionForEvent(
  eventType: string | null | undefined,
): boolean {
  return eventType === 'email.bounced' || eventType === 'email.complained'
}

// ------------------------------------------------------------- marketing footer
// Marketing email must identify the sender and give a way to opt out. A postal address
// is required by CAN-SPAM for messages to US recipients and is good practice elsewhere.
// It comes from configuration because the registered business details are an owner
// decision, not something the code may invent.
export interface SenderIdentity {
  name: string
  address: string
}

export function marketingSenderIdentity(env: {
  MARKETING_SENDER_NAME?: string
  MARKETING_SENDER_ADDRESS?: string
}): SenderIdentity | null {
  const address = (env.MARKETING_SENDER_ADDRESS ?? '').trim()
  if (address.length < 10) return null
  const name = (env.MARKETING_SENDER_NAME ?? '').trim() || 'Food4Love'
  return { name: name.slice(0, 120), address: address.slice(0, 300) }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  )
}

export function marketingFooterHtml(input: {
  unsubscribeUrl: string
  sender: SenderIdentity
}): string {
  return (
    `<p style="font-size:12px;color:#6e5a52">You receive Food4Love updates because you opted in. ` +
    `<a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>` +
    `<p style="font-size:12px;color:#6e5a52">Sent by ${escapeHtml(input.sender.name)}, ${escapeHtml(input.sender.address)}</p>`
  )
}

export function marketingFooterText(input: {
  unsubscribeUrl: string
  sender: SenderIdentity
}): string {
  return `You receive Food4Love updates because you opted in.\nUnsubscribe: ${input.unsubscribeUrl}\nSent by ${input.sender.name}, ${input.sender.address}`
}
