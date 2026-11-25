// Can this browser receive Web Push, and if not, what should we tell the member?
// Pure (no imports, no globals): the caller passes in what it observed, so every case is testable.

export type PushSupport =
  | 'supported' // can ask for permission now
  | 'needs-install-ios' // iPhone/iPad Safari tab: Add to Home Screen first (iOS 16.4+)
  | 'ios-too-old' // iOS/iPadOS before 16.4 has no Web Push at all
  | 'denied' // the member blocked notifications for this site in the browser
  | 'insecure' // not HTTPS (or localhost): browsers refuse push
  | 'unsupported' // no service worker / PushManager / Notification API

export interface PushEnvironment {
  secureContext: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  permission: 'default' | 'granted' | 'denied' | null
  standalone: boolean // launched from the Home Screen / installed app
  userAgent: string
  maxTouchPoints: number
  platform: string
}

export function isAppleMobile(
  env: Pick<PushEnvironment, 'userAgent' | 'platform' | 'maxTouchPoints'>,
) {
  return (
    /iphone|ipad|ipod/i.test(env.userAgent) ||
    // iPadOS 13+ reports itself as a Mac with touch
    (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
  )
}

// iOS version from the user agent ("OS 17_4 like Mac OS X" / "Version/17.4"), or null.
export function iosVersion(userAgent: string): number | null {
  const os = /OS (\d+)[_.](\d+)/.exec(userAgent)
  const version = os ?? /Version\/(\d+)\.(\d+)/.exec(userAgent)
  if (!version) return null
  return Number(version[1]) + Number(version[2]) / 100
}

export function detectPushSupport(env: PushEnvironment): PushSupport {
  const apple = isAppleMobile(env)
  if (apple) {
    const version = iosVersion(env.userAgent)
    if (version !== null && version < 16.04) return 'ios-too-old'
    // Safari only exposes PushManager to an installed Home Screen web app
    if (!env.standalone) return 'needs-install-ios'
  }
  if (!env.secureContext) return 'insecure'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification)
    return apple ? 'needs-install-ios' : 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return 'supported'
}

export function platformFromUserAgent(
  env: Pick<PushEnvironment, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'chromeos' | 'other' {
  const ua = env.userAgent
  if (isAppleMobile(env)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (/windows/i.test(ua)) return 'windows'
  if (/macintosh|mac os x/i.test(ua)) return 'macos'
  if (/linux/i.test(ua)) return 'linux'
  return 'other'
}

// "Chrome on Android", "Safari on iPhone": shown in Connected devices. Never includes versions or
// anything that fingerprints the device more than needed.
export function deviceLabel(
  env: Pick<
    PushEnvironment,
    'userAgent' | 'platform' | 'maxTouchPoints' | 'standalone'
  >,
): string {
  const ua = env.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua) || /CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser'
  const place = {
    android: 'Android',
    ios: /ipad/i.test(ua) || env.platform === 'MacIntel' ? 'iPad' : 'iPhone',
    windows: 'Windows',
    macos: 'Mac',
    linux: 'Linux',
    chromeos: 'Chromebook',
    other: 'this device',
  }[platformFromUserAgent(env)]
  return env.standalone ? `Food4Love app on ${place}` : `${browser} on ${place}`
}

// What to show the member for each state (plain language, no promises about sound or timing).
export const PUSH_SUPPORT_MESSAGE: Record<
  Exclude<PushSupport, 'supported'>,
  string
> = {
  'needs-install-ios':
    'On iPhone and iPad, notifications work only from the installed app. In Safari tap Share, then Add to Home Screen, open Food4Love from your Home Screen and turn notifications on there.',
  'ios-too-old':
    'Notifications need iOS or iPadOS 16.4 or later. You will still see every update in the app.',
  denied:
    'Notifications are blocked for Food4Love in your browser settings. Allow them there, then come back to turn them on.',
  insecure: 'Notifications only work on the secure (https) Food4Love site.',
  unsupported:
    'This browser cannot receive Food4Love notifications. You will still see every update in the app.',
}

// VAPID public key (base64url) -> bytes for PushManager.subscribe()
export function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded =
    value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
