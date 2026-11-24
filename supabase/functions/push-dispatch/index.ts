// Supabase Edge Function: push-dispatch
//
// Drains public.notification_push_deliveries. Called by the database (pg_net "kick" on every new
// queued delivery, plus a pg_cron sweep every minute for retries). It takes NO input: the request
// body is ignored, so a caller can only make it process the real queue.
//
// Auth: header x-food4love-dispatch-secret must equal PUSH_DISPATCH_SECRET (deploy with
// --no-verify-jwt; the database has no user JWT to send). Responses carry counts only.
//
// Secrets (set with `supabase secrets set`, never committed):
//   PUSH_DISPATCH_SECRET   random, also stored in Vault as food4love_push_dispatch_secret
//   VAPID_KEYS_JSON        {"publicKey":{JWK},"privateKey":{JWK}} from scripts/generate-vapid-keys.mjs
//   VAPID_SUBJECT          mailto: contact the push services can reach about abuse
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   provided by Supabase automatically
//
// Encryption and VAPID signing: jsr:@negrel/webpush (RFC 8291 aes128gcm + RFC 8292, Web Crypto
// only). A new ApplicationServer (fresh ECDH key) is created per message.

import { createClient } from 'npm:@supabase/supabase-js@2.44.4'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import {
  type ClaimedDelivery,
  type PushOptions,
  type PushPayload,
  runDispatch,
  timingSafeEqual,
} from '../_shared/push-core.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

let vapidKeys: CryptoKeyPair | null = null
async function loadVapidKeys(): Promise<CryptoKeyPair> {
  if (vapidKeys) return vapidKeys
  const raw = Deno.env.get('VAPID_KEYS_JSON')
  if (!raw) throw new Error('VAPID_KEYS_JSON missing')
  vapidKeys = await webpush.importVapidKeys(JSON.parse(raw), {
    extractable: false,
  })
  return vapidKeys
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed' }, 405)

  const expected = Deno.env.get('PUSH_DISPATCH_SECRET') ?? ''
  const given = request.headers.get('x-food4love-dispatch-secret') ?? ''
  if (expected.length < 32) return json({ error: 'Not configured' }, 503)
  if (!timingSafeEqual(given, expected))
    return json({ error: 'Unauthorized' }, 401)

  const subject = Deno.env.get('VAPID_SUBJECT') ?? ''
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://'))
    return json({ error: 'Not configured' }, 503)

  let keys: CryptoKeyPair
  try {
    keys = await loadVapidKeys()
  } catch {
    return json({ error: 'Not configured' }, 503)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  try {
    const result = await runDispatch({
      now: () => Date.now(),
      claim: async (limit) => {
        const { data, error } = await supabase.rpc('food4love_push_claim', {
          p_limit: limit,
        })
        if (error) throw new Error(`claim failed: ${error.code}`)
        return (data ?? []) as ClaimedDelivery[]
      },
      complete: async (row, outcome, httpStatus, errorCode) => {
        const { error } = await supabase.rpc('food4love_push_complete', {
          p_delivery_id: row.delivery_id,
          p_claim_token: row.claim_token,
          p_outcome: outcome,
          p_http_status: httpStatus,
          p_error_code: errorCode,
        })
        if (error) throw new Error(`complete failed: ${error.code}`)
      },
      send: async (
        row: ClaimedDelivery,
        payload: PushPayload,
        options: PushOptions,
      ) => {
        const server = await webpush.ApplicationServer.new({
          contactInformation: subject,
          vapidKeys: keys,
        })
        const subscriber = server.subscribe({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_secret },
        })
        try {
          await subscriber.pushTextMessage(JSON.stringify(payload), {
            ttl: options.ttl,
            urgency: options.urgency as webpush.Urgency,
            topic: options.topic,
          })
          return 201
        } catch (error) {
          if (error instanceof webpush.PushMessageError) {
            const status = error.response.status
            await error.response.body?.cancel().catch(() => undefined)
            return status
          }
          return null // network error, timeout, bad subscription keys
        }
      },
    })
    // counts only: no endpoints, user ids or payloads leave this function
    return json({ ok: true, ...result })
  } catch (error) {
    console.error(
      'push-dispatch failed',
      error instanceof Error ? error.message : 'unknown',
    )
    return json({ error: 'Processing failed' }, 500)
  }
})
