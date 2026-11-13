// Verifies the signature Resend (via Svix) puts on webhook calls, so only real
// Resend events can change an email's status. No dependency: it is HMAC-SHA256
// over "<id>.<timestamp>.<raw body>" using the base64 part of the secret.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySvixSignature(input: {
  id: string | null
  timestamp: string | null
  signatureHeader: string | null
  body: string
  secret: string
  nowMs?: number
  toleranceSeconds?: number
}): boolean {
  const { id, timestamp, signatureHeader, body, secret } = input
  if (!id || !timestamp || !signatureHeader || !secret) return false

  const stamp = Number(timestamp)
  if (!Number.isFinite(stamp)) return false
  const nowSeconds = (input.nowMs ?? Date.now()) / 1000
  if (Math.abs(nowSeconds - stamp) > (input.toleranceSeconds ?? 300)) {
    return false // too old or too new: stops replay of captured requests
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest()

  // The header holds one or more space-separated "v1,<base64>" values.
  for (const part of signatureHeader.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    const received = Buffer.from(value, 'base64')
    if (
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    ) {
      return true
    }
  }
  return false
}
