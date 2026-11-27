'use client'

import * as Switch from '@radix-ui/react-switch'
import { activationMessage } from '@/lib/push/activation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { BellRing, Laptop, Smartphone, Trash2 } from 'lucide-react'
import { updateProfile } from '@/services/profiles'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { PUSH_SUPPORT_MESSAGE } from '@/lib/push/support'
import { PushDiagnosticsPanel } from '@/components/notifications/PushDiagnosticsPanel'
import type { PushPreferences } from '@/types/db'

type PushKey = Exclude<keyof PushPreferences, 'enabled'>

const categoryOptions: Array<{
  key: PushKey
  title: string
  description: string
}> = [
  { key: 'messages', title: 'Messages', description: 'New chat messages' },
  {
    key: 'matches',
    title: 'Matches and likes',
    description: 'New matches, likes and requests',
  },
  {
    key: 'bookings',
    title: 'Bookings',
    description: 'Requests, confirmations, changes and payments',
  },
  {
    key: 'verification',
    title: 'Verification',
    description: 'Updates about cook verification',
  },
  { key: 'stories', title: 'Stories', description: 'Activity on stories' },
  {
    key: 'updates',
    title: 'Other updates',
    description: 'Rewards, reviews and Food4Love announcements',
  },
]

const switchClass =
  'relative h-6 w-11 shrink-0 rounded-full bg-[var(--border)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-60 data-[state=checked]:bg-[var(--accent)]'
const thumbClass =
  'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]'

function lastDelivered(value: string | null) {
  if (!value) return 'No notification delivered yet'
  return `Last delivered ${new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))}`
}

export function PushNotificationSettings() {
  const profile = useAuthStore((state) => state.profile)
  const updateStore = useAuthStore((state) => state.updateProfile)
  const push = usePushNotifications()
  const [saving, setSaving] = useState<string | null>(null)

  if (!profile) return null
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...profile.notification_preferences,
  }
  const pushPrefs: PushPreferences = preferences.push ?? {}
  const allowed = pushPrefs.enabled !== false

  const savePush = async (key: keyof PushPreferences, checked: boolean) => {
    if (saving) return
    setSaving(key)
    try {
      const updated = await updateProfile(profile.id, {
        notification_preferences: {
          ...preferences,
          push: { ...pushPrefs, [key]: checked },
        },
      })
      updateStore(updated)
      toast.success('Notification preference saved')
    } catch {
      toast.error('Could not save this preference')
    } finally {
      setSaving(null)
    }
  }

  const turnOn = async () => {
    const result = await push.turnOn()
    if (result.ok) {
      toast.success('Notifications are on for this device')
      if (!allowed) await savePush('enabled', true)
      return
    }
    if (result.reason === 'in_progress') return // the first tap is still running
    toast.error(
      result.reason === 'denied'
        ? PUSH_SUPPORT_MESSAGE.denied
        : activationMessage(result),
    )
  }

  const sendTest = async () => {
    const error = await push.sendTest()
    if (error) toast.error(error)
    else
      toast.success(
        'Test sent. Follow its progress under "Check this device" below.',
      )
  }

  const support = push.support
  return (
    <section
      aria-labelledby="push-settings-title"
      className="border-t border-[var(--border)]"
    >
      <div className="space-y-2 px-5 pb-3 pt-5">
        <h3
          id="push-settings-title"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-1)]"
        >
          <BellRing
            className="h-4 w-4 text-[var(--accent)]"
            aria-hidden="true"
          />
          Push notifications
        </h3>
        <p className="text-xs leading-5 text-[var(--text-3)]">
          Get alerts on your phone or computer when Food4Love is closed. They
          never show message text, names or addresses, only that something new
          is waiting. Delivery timing and sound depend on your device.
        </p>
      </div>

      {/* this device */}
      <div className="px-5 pb-4">
        {support === 'checking' ? (
          <p className="text-xs text-[var(--text-3)]" role="status">
            Checking this device…
          </p>
        ) : !push.onHere && push.enrolledKnown && !push.enrolled ? (
          <p className="rounded-xl bg-[var(--bg-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            Push notifications are being tested with a small group of members
            first. You will still see every update in the app.
          </p>
        ) : support !== 'supported' ? (
          <p className="rounded-xl bg-[var(--bg-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            {PUSH_SUPPORT_MESSAGE[support]}
          </p>
        ) : push.onHere ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--success)]">
              On for this device
            </span>
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={push.busy}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
            >
              Send a test
            </button>
            <button
              type="button"
              onClick={() => void push.turnOff()}
              disabled={push.busy}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg-2)] disabled:opacity-50"
            >
              Turn off on this device
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void turnOn()}
            disabled={push.busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" aria-hidden="true" />
            {push.busy
              ? push.busyStage === 'permission'
                ? 'Waiting for your answer…'
                : 'Turning on…'
              : 'Turn on notifications on this device'}
          </button>
        )}
      </div>

      {/* account-wide choices */}
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-1)]">
              Allow push on all my devices
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              Off pauses every push, including security alerts. Your in-app
              notifications are not affected.
            </p>
          </div>
          <Switch.Root
            checked={allowed}
            onCheckedChange={(checked) => void savePush('enabled', checked)}
            disabled={saving !== null}
            aria-label="Allow push on all my devices"
            className={switchClass}
          >
            <Switch.Thumb className={thumbClass} />
          </Switch.Root>
        </div>
        {categoryOptions.map(({ key, title, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-1)]">
                {title}
              </p>
              <p className="mt-1 text-xs text-[var(--text-3)]">{description}</p>
            </div>
            <Switch.Root
              checked={allowed && pushPrefs[key] !== false}
              onCheckedChange={(checked) => void savePush(key, checked)}
              disabled={saving !== null || !allowed}
              aria-label={`Push: ${title}`}
              className={switchClass}
            >
              <Switch.Thumb className={thumbClass} />
            </Switch.Root>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-1)]">Sound</p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              Ask your device to play its notification sound. iPhone and some
              browsers always use their own setting.
            </p>
          </div>
          <Switch.Root
            checked={allowed && pushPrefs.sound !== false}
            onCheckedChange={(checked) => void savePush('sound', checked)}
            disabled={saving !== null || !allowed}
            aria-label="Push: sound"
            className={switchClass}
          >
            <Switch.Thumb className={thumbClass} />
          </Switch.Root>
        </div>
        <p className="px-5 py-3 text-xs text-[var(--text-3)]">
          Security alerts about your account are always sent while push is
          allowed.
        </p>
      </div>

      <PushDiagnosticsPanel
        input={push.diagnostics}
        onRefresh={() => void push.refresh()}
      />

      {/* connected devices */}
      <div className="border-t border-[var(--border)] px-5 py-4">
        <p className="text-sm font-semibold text-[var(--text-1)]">
          Connected devices
        </p>
        {push.devicesLoading ? (
          <p className="mt-2 text-xs text-[var(--text-3)]" role="status">
            Loading devices…
          </p>
        ) : push.devices.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-3)]">
            No devices receive push notifications yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {push.devices.map((device) => {
              const Icon =
                device.platform === 'android' || device.platform === 'ios'
                  ? Smartphone
                  : Laptop
              const here = device.id === push.thisDeviceId
              return (
                <li key={device.id} className="flex items-center gap-3 py-3">
                  <Icon
                    className="h-4 w-4 shrink-0 text-[var(--text-3)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--text-1)]">
                      {device.label ?? 'Device'}
                      {here && (
                        <span className="ml-2 text-xs font-semibold text-[var(--accent)]">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-3)]">
                      {lastDelivered(device.last_success_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await push.removeDevice(device.id)
                      if (ok) toast.success('Device removed')
                      else toast.error('Could not remove this device')
                    }}
                    aria-label={`Remove ${device.label ?? 'device'}`}
                    className="rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
