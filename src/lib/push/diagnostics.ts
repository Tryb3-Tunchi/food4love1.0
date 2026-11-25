// "Why don't I get notifications on this device?": one honest answer per stage of the chain.
// Pure (no imports) so every case is unit-tested. Each stage is proven separately; a row in the
// in-app bell is never treated as proof that a device received or displayed a push.

export type StageState = 'ok' | 'fail' | 'waiting' | 'unknown'

export interface PushDiagnosticInput {
  support:
    | 'checking'
    | 'supported'
    | 'needs-install-ios'
    | 'ios-too-old'
    | 'denied'
    | 'insecure'
    | 'unsupported'
  keyInApp: 'ok' | 'missing' | 'invalid'
  keyOnServer: boolean | null // null = not known yet
  enrolled: boolean | null
  permission: 'default' | 'granted' | 'denied' | null
  serviceWorkerActive: boolean | null
  browserSubscribed: boolean
  serverKnowsThisDevice: boolean | null
  latestDelivery: {
    status: string
    http_status: number | null
    error_code: string | null
    created_at: string
  } | null
  lastShownAt: string | null
}

export interface Stage {
  key: string
  label: string
  state: StageState
  detail: string
}

export function pushDiagnostics(input: PushDiagnosticInput): Stage[] {
  const stages: Stage[] = []
  const add = (key: string, label: string, state: StageState, detail: string) =>
    stages.push({ key, label, state, detail })

  // 1. can this browser / installation receive Web Push at all
  if (input.support === 'checking')
    add(
      'support',
      'This browser supports notifications',
      'unknown',
      'Checking…',
    )
  else if (input.support === 'supported' || input.support === 'denied')
    add(
      'support',
      'This browser supports notifications',
      'ok',
      'Web Push is available here.',
    )
  else
    add(
      'support',
      'This browser supports notifications',
      'fail',
      {
        'needs-install-ios':
          'On iPhone and iPad, notifications only work in the installed app: Safari, Share, Add to Home Screen, then open Food4Love from the Home Screen.',
        'ios-too-old': 'Needs iOS or iPadOS 16.4 or later.',
        insecure:
          'Only the secure (https) Food4Love site can receive notifications.',
        unsupported: 'This browser cannot receive Web Push notifications.',
      }[input.support],
    )

  // 2. the app version on this device has the push key (inlined when the site was BUILT)
  if (input.keyInApp === 'ok')
    add(
      'key',
      'Notifications are set up in this version of Food4Love',
      'ok',
      'The push key is present.',
    )
  else
    add(
      'key',
      'Notifications are set up in this version of Food4Love',
      'fail',
      input.keyOnServer
        ? 'This device is running an older version of Food4Love. Close every Food4Love tab (or the installed app) and open it again.'
        : input.keyInApp === 'invalid'
          ? 'The stored push key is not a valid key. Check src/lib/push/publicKeys.ts.'
          : 'This deployment talks to a Supabase project without a Food4Love push key, so notifications are off here.',
    )

  // 3. pilot enrollment (server-side, fails closed)
  add(
    'enrolled',
    'Your account can turn on notifications',
    input.enrolled === null ? 'unknown' : input.enrolled ? 'ok' : 'fail',
    input.enrolled === null
      ? 'Checking…'
      : input.enrolled
        ? 'Your account is in the notifications pilot.'
        : 'Notifications are being tested with a small group; your account is not in it yet.',
  )

  // 4. browser permission
  add(
    'permission',
    'Notifications are allowed for Food4Love',
    input.permission === 'granted'
      ? 'ok'
      : input.permission === 'denied'
        ? 'fail'
        : 'waiting',
    input.permission === 'granted'
      ? 'Allowed in this browser.'
      : input.permission === 'denied'
        ? 'Blocked in the browser or phone settings. Allow notifications for Food4Love there.'
        : 'Not asked yet: tap "Turn on notifications on this device".',
  )

  // 5. this device is registered (browser subscription AND the server knows it)
  const registered =
    input.browserSubscribed && input.serverKnowsThisDevice === true
  add(
    'registered',
    'This device is registered',
    registered
      ? 'ok'
      : input.serviceWorkerActive === false
        ? 'fail'
        : input.browserSubscribed && input.serverKnowsThisDevice === null
          ? 'unknown'
          : 'waiting',
    registered
      ? 'Food4Love can send notifications to this device.'
      : input.serviceWorkerActive === false
        ? 'The Food4Love background service is not running. Close every Food4Love tab and open it again.'
        : input.browserSubscribed
          ? 'Reconnecting this device…'
          : 'Not registered yet.',
  )

  // 6. last delivery to this device: queued -> accepted by the push service (Google/Apple/Mozilla)
  const d = input.latestDelivery
  if (!d)
    add(
      'accepted',
      'The push service accepted the last notification',
      'waiting',
      'Nothing sent to this device yet. Tap "Send a test".',
    )
  else if (d.status === 'sent')
    add(
      'accepted',
      'The push service accepted the last notification',
      'ok',
      'Delivered to the push service (it then delivers to the device when it can).',
    )
  else if (d.status === 'queued' || d.status === 'sending')
    add(
      'accepted',
      'The push service accepted the last notification',
      'waiting',
      'Queued: sending in the next few seconds.',
    )
  else if (d.status === 'expired')
    add(
      'accepted',
      'The push service accepted the last notification',
      'fail',
      'The push service said this device is no longer subscribed. Turn notifications on again here.',
    )
  else if (d.status === 'skipped')
    add(
      'accepted',
      'The push service accepted the last notification',
      'unknown',
      d.error_code === 'already_read'
        ? 'Skipped: it was already read before it could be sent.'
        : 'Skipped (too old or device removed).',
    )
  else
    add(
      'accepted',
      'The push service accepted the last notification',
      'fail',
      `Not accepted yet${d.http_status ? ` (HTTP ${d.http_status})` : ''}${d.error_code ? `, ${d.error_code}` : ''}. Food4Love retries automatically.`,
    )

  // 7. actually displayed by this device (recorded by the service worker after showing it)
  const shownAfter =
    input.lastShownAt && d
      ? Date.parse(input.lastShownAt) >= Date.parse(d.created_at) - 1000
      : false
  add(
    'shown',
    'This device displayed it',
    shownAfter
      ? 'ok'
      : d?.status === 'sent'
        ? 'waiting'
        : input.lastShownAt
          ? 'ok'
          : 'waiting',
    shownAfter
      ? `Shown on this device at ${new Date(input.lastShownAt!).toLocaleTimeString()}.`
      : d?.status === 'sent'
        ? "Not shown on this device yet. If it never appears, check the phone's notification and battery settings for your browser."
        : input.lastShownAt
          ? `Last shown on this device at ${new Date(input.lastShownAt).toLocaleString()}.`
          : 'No Food4Love notification has been shown on this device yet.',
  )
  return stages
}
