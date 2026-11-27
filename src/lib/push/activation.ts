// "Turn on notifications" as a sequence of bounded steps. Pure (no imports, no globals): the browser
// operations are passed in, so every hang and failure can be simulated in unit tests.
//
// Guarantees:
//  * every step has a time limit, so the button can never wait forever;
//  * permission is requested only if it was never granted (no repeated prompts);
//  * an existing valid subscription is reused (no duplicate devices: the server upserts by endpoint);
//  * a subscribe() that completes AFTER its time limit is not lost: it is registered in the
//    background and reported through onLateSuccess;
//  * success is reported only after the server confirmed the device;
//  * a subscription is only ever registered for the account that tapped the button: if the
//    signed-in account changes (sign-out, account switch) the attempt stops, a late subscription
//    is cancelled instead of registered, and the server refuses a request whose session is no
//    longer that account (register() sends the expected account id).

export type ActivationStage =
  'permission' | 'service_worker' | 'subscription' | 'server'

export type ActivationFailure =
  | { reason: 'denied' }
  | { reason: 'dismissed' }
  | { reason: 'key_missing' }
  | { reason: 'key_invalid' }
  | { reason: 'not_enrolled' }
  | { reason: 'enrollment_unavailable' }
  | { reason: 'service_unavailable' }
  | { reason: 'timeout'; stage: ActivationStage }
  | { reason: 'register_failed'; status?: number }
  | { reason: 'account_changed' }
  | { reason: 'in_progress' }
  | { reason: 'failed'; message?: string }

export type ActivationResult =
  | { ok: true; deviceId: string; reusedSubscription: boolean }
  | ({ ok: false } & ActivationFailure)

export interface ActivationDeps<Reg, Sub> {
  keyStatus: () => 'ok' | 'missing' | 'invalid'
  permissionState: () => 'default' | 'granted' | 'denied' | null
  requestPermission: () => Promise<string | undefined>
  activeRegistration: () => Promise<Reg | null>
  getSubscription: (reg: Reg) => Promise<Sub | null>
  keyMatches: (sub: Sub) => boolean
  unsubscribe: (sub: Sub) => Promise<unknown>
  subscribe: (reg: Reg) => Promise<Sub>
  // resolves with the device id, or throws RegisterError
  register: (sub: Sub, signal: AbortSignal) => Promise<string>
  beforeSubscribe: () => void // e.g. remember which account started this attempt
  // is the account that started this attempt still the one signed in here?
  isCurrentAccount: () => boolean
  onRegistered: (deviceId: string) => void
  onLateSuccess: (deviceId: string) => void
  onStage?: (stage: 'permission' | 'setting_up') => void // what the button says
  setTimer: (fn: () => void, ms: number) => unknown
  now?: () => number
}

export class RegisterError extends Error {
  code: string
  status: number
  constructor(code: string, status: number, message?: string) {
    super(message ?? code)
    this.code = code
    this.status = status
  }
}

// Per-step limits, plus ONE overall budget for everything after the permission answer, so the
// member waits at most ~25 s once they have tapped Allow (or immediately, when already granted).
// The prompt has its own limit: it waits for a person, and cutting it short would not stop it.
export const ACTIVATION_TIMEOUTS = {
  permission: 60_000,
  service_worker: 8_000,
  subscription: 15_000, // the push service (FCM/APNs/Mozilla) can be slow on mobile networks
  server: 12_000,
  after_permission: 25_000,
} as const

const TIMED_OUT = Symbol('timed out')

function within<T>(
  promise: Promise<T>,
  ms: number,
  setTimer: ActivationDeps<unknown, unknown>['setTimer'],
): Promise<T | typeof TIMED_OUT> {
  return Promise.race([
    promise,
    new Promise<typeof TIMED_OUT>((resolve) =>
      setTimer(() => resolve(TIMED_OUT), ms),
    ),
  ])
}

function failureFromRegister(error: unknown): ActivationFailure {
  if (error instanceof RegisterError) {
    if (error.code === 'not_enrolled') return { reason: 'not_enrolled' }
    if (error.code === 'account_changed') return { reason: 'account_changed' }
    if (error.code === 'enrollment_unavailable')
      return { reason: 'enrollment_unavailable' }
    return { reason: 'register_failed', status: error.status }
  }
  return { reason: 'register_failed' }
}

export async function runActivation<Reg, Sub>(
  deps: ActivationDeps<Reg, Sub>,
  timeouts: {
    [K in keyof typeof ACTIVATION_TIMEOUTS]: number
  } = ACTIVATION_TIMEOUTS,
): Promise<ActivationResult> {
  const keys = deps.keyStatus()
  if (keys === 'missing') return { ok: false, reason: 'key_missing' }
  if (keys === 'invalid') return { ok: false, reason: 'key_invalid' }

  // 1. permission: never re-prompt once granted
  const permission = deps.permissionState()
  if (permission === 'denied') return { ok: false, reason: 'denied' }
  if (permission !== 'granted') {
    deps.onStage?.('permission')
    const answer = await within(
      deps.requestPermission().catch(() => undefined),
      timeouts.permission,
      deps.setTimer,
    )
    if (answer === TIMED_OUT)
      return { ok: false, reason: 'timeout', stage: 'permission' }
    const after: string | null | undefined = answer ?? deps.permissionState()
    if (after === 'denied') return { ok: false, reason: 'denied' }
    if (after !== 'granted') return { ok: false, reason: 'dismissed' }
  }

  deps.onStage?.('setting_up')
  const now = deps.now ?? Date.now
  const deadline = now() + timeouts.after_permission
  // each later step gets its own limit, never more than what is left of the overall budget
  const limit = (step: number) => Math.max(0, Math.min(step, deadline - now()))

  // 2. an ACTIVE service worker (subscribe() on an installing/waiting one can hang)
  const reg = await within(
    deps.activeRegistration().catch(() => null),
    limit(timeouts.service_worker),
    deps.setTimer,
  )
  if (reg === TIMED_OUT)
    return { ok: false, reason: 'timeout', stage: 'service_worker' }
  if (!reg) return { ok: false, reason: 'service_unavailable' }

  // 3. reuse a valid existing subscription, otherwise subscribe
  let reused = false
  const existing = await within(
    deps.getSubscription(reg).catch(() => null),
    limit(timeouts.subscription),
    deps.setTimer,
  )
  if (existing === TIMED_OUT)
    return { ok: false, reason: 'timeout', stage: 'subscription' }
  let subscription: Sub | null = existing
  if (subscription && !deps.keyMatches(subscription)) {
    // made for another key (staging vs production, rotation): unusable
    await within(
      deps.unsubscribe(subscription).catch(() => undefined),
      limit(timeouts.subscription),
      deps.setTimer,
    )
    subscription = null
  }
  deps.beforeSubscribe()
  if (subscription) reused = true
  else {
    const pending = deps.subscribe(reg)
    const made = await within(
      pending.catch(() => null),
      limit(timeouts.subscription),
      deps.setTimer,
    )
    if (made === TIMED_OUT) {
      // finish quietly if the browser completes later; never lose a valid subscription
      // (the UI has already shown the timeout; this only ever adds the device, never a success toast)
      void pending
        .then(async (late) => {
          if (!deps.isCurrentAccount()) {
            // the member signed out or switched account: this subscription is nobody's now
            await deps.unsubscribe(late).catch(() => undefined)
            return
          }
          const controller = new AbortController()
          const done = await within(
            deps.register(late, controller.signal),
            timeouts.server,
            deps.setTimer,
          )
          if (done === TIMED_OUT) {
            controller.abort()
            return // the next app start retries (pending marker), without a prompt
          }
          if (!deps.isCurrentAccount()) return
          deps.onRegistered(done)
          deps.onLateSuccess(done)
        })
        .catch(() => undefined)
      return { ok: false, reason: 'timeout', stage: 'subscription' }
    }
    if (!made)
      return { ok: false, reason: 'failed', message: 'subscribe_rejected' }
    subscription = made
  }

  // 4. the server confirms the device (idempotent: same endpoint = same row)
  if (!deps.isCurrentAccount()) return { ok: false, reason: 'account_changed' }
  const controller = new AbortController()
  const registered = await within(
    deps.register(subscription, controller.signal).then(
      (id) => ({ id }),
      (error: unknown) => ({ error }),
    ),
    limit(timeouts.server),
    deps.setTimer,
  )
  if (registered === TIMED_OUT) {
    // the request is cancelled; a retry re-sends the same subscription (server upserts by endpoint)
    controller.abort()
    return { ok: false, reason: 'timeout', stage: 'server' }
  }
  if ('error' in registered)
    return { ok: false, ...failureFromRegister(registered.error) }
  // signed out / switched while the request was in flight: never report success to the new session
  if (!deps.isCurrentAccount()) return { ok: false, reason: 'account_changed' }
  deps.onRegistered(registered.id)
  return { ok: true, deviceId: registered.id, reusedSubscription: reused }
}

// What the member sees for each outcome (plain language; reflects the real failure).
export function activationMessage(result: ActivationResult): string {
  if (result.ok) return 'Notifications are on for this device.'
  switch (result.reason) {
    case 'denied':
      return 'Notifications are blocked for Food4Love. Allow them in your browser or phone settings, then try again.'
    case 'dismissed':
      return 'Notifications were not turned on. Tap the button again and choose Allow.'
    case 'key_missing':
    case 'key_invalid':
      return 'Notifications are not available on this version of Food4Love.'
    case 'not_enrolled':
      return 'Notifications are not available for your account yet.'
    case 'enrollment_unavailable':
      return 'Could not check notification access. Please try again in a moment.'
    case 'service_unavailable':
      return 'The Food4Love background service is not ready on this device. Close Food4Love completely, open it again and retry.'
    case 'timeout':
      return result.stage === 'permission'
        ? 'The permission prompt did not answer. Please try again.'
        : result.stage === 'service_worker'
          ? 'The Food4Love background service took too long to start. Close Food4Love completely, open it again and retry.'
          : result.stage === 'subscription'
            ? 'Your device took too long to set up notifications (connection timed out). Please retry; if it finishes in the background we will turn them on automatically.'
            : 'Connection timed out while registering this device. Please retry.'
    case 'account_changed':
      return 'You signed in with a different account while notifications were being turned on. Nothing was changed; please try again.'
    case 'in_progress':
      return 'Notifications are already being turned on. Please wait a moment.'
    case 'register_failed':
      return 'Unable to register this device. Please retry.'
    default:
      return 'Could not turn on notifications. Please retry.'
  }
}
