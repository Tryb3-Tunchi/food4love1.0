'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  type EnableResult,
  browserSubscription,
  currentDeviceId,
  disablePush,
  enablePush,
  lastPushShownOnThisDevice,
  pushKeyStatus,
  pushSupport,
  resyncThisDevice,
} from '@/lib/push/client'
import type { PushSupport } from '@/lib/push/support'

export interface PushDeliveryState {
  status: string
  http_status: number | null
  error_code: string | null
  created_at: string
  sent_at: string | null
}

export interface PushDevice {
  id: string
  label: string | null
  platform: string
  installed: boolean
  created_at: string
  last_success_at: string | null
  latest_delivery?: PushDeliveryState | null
}

interface DevicesResponse {
  devices: PushDevice[]
  enrolled: boolean
  keyOnServer: boolean | null
}

async function loadDevices(): Promise<DevicesResponse> {
  const response = await fetch('/api/push/subscriptions', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load devices')
  const body = (await response.json()) as {
    devices?: PushDevice[]
    enrolled?: boolean
    server?: { publicKeyConfigured?: boolean }
  }
  return {
    devices: body.devices ?? [],
    enrolled: body.enrolled === true,
    keyOnServer:
      typeof body.server?.publicKeyConfigured === 'boolean'
        ? body.server.publicKeyConfigured
        : null,
  }
}

export function usePushNotifications() {
  const userId = useAuthStore((state) => state.profile?.id ?? null)
  const queryClient = useQueryClient()
  const [support, setSupport] = useState<PushSupport | 'checking'>('checking')
  const [onHere, setOnHere] = useState(false)
  const [browserSubscribed, setBrowserSubscribed] = useState(false)
  const [permission, setPermission] = useState<
    'default' | 'granted' | 'denied' | null
  >(null)
  const [serviceWorkerActive, setServiceWorkerActive] = useState<
    boolean | null
  >(null)
  const [lastShownAt, setLastShownAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const resyncTried = useRef(false)

  const refreshLocal = useCallback(async () => {
    setSupport(pushSupport())
    setPermission(
      typeof Notification === 'undefined' ? null : Notification.permission,
    )
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker
        .getRegistration('/')
        .catch(() => undefined)
      setServiceWorkerActive(Boolean(reg?.active))
    } else setServiceWorkerActive(false)
    const subscription = await browserSubscription().catch(() => null)
    setBrowserSubscribed(Boolean(subscription))
    setOnHere(Boolean(subscription) && currentDeviceId() !== null)
    setLastShownAt((await lastPushShownOnThisDevice())?.at ?? null)
  }, [])

  useEffect(() => {
    void refreshLocal()
  }, [refreshLocal])

  const devices = useQuery({
    queryKey: ['push-devices', userId],
    queryFn: loadDevices,
    enabled: !!userId,
  })
  const reloadDevices = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['push-devices', userId] }),
    [queryClient, userId],
  )

  const thisDeviceId = typeof window === 'undefined' ? null : currentDeviceId()
  const serverDevices = devices.data?.devices
  const serverKnowsThisDevice =
    serverDevices === undefined
      ? null
      : thisDeviceId !== null &&
        serverDevices.some((d) => d.id === thisDeviceId)

  // Self-heal once per visit: the browser still holds a valid subscription (permission granted)
  // but the server no longer lists this device (expired endpoint cleaned up, removed from another
  // device, or registered under a previous key). Re-register it silently; no new prompt.
  useEffect(() => {
    if (
      resyncTried.current ||
      !userId ||
      !browserSubscribed ||
      permission !== 'granted' ||
      devices.data?.enrolled !== true ||
      serverKnowsThisDevice !== false
    )
      return
    resyncTried.current = true
    void resyncThisDevice(userId).then(async (ok) => {
      if (!ok) return
      await refreshLocal()
      await reloadDevices()
    })
  }, [
    userId,
    browserSubscribed,
    permission,
    devices.data?.enrolled,
    serverKnowsThisDevice,
    refreshLocal,
    reloadDevices,
  ])

  // Keep this call synchronous up to enablePush(): the permission prompt needs the tap.
  const turnOn = async (): Promise<EnableResult> => {
    if (!userId) return { ok: false, reason: 'failed' }
    setBusy(true)
    try {
      const result = await enablePush(userId)
      await refreshLocal()
      await reloadDevices()
      return result
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      await disablePush()
      await refreshLocal()
      await reloadDevices()
    } finally {
      setBusy(false)
    }
  }

  const removeDevice = async (id: string): Promise<boolean> => {
    if (id === currentDeviceId()) {
      await turnOff()
      return true
    }
    const response = await fetch(
      `/api/push/subscriptions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
    await reloadDevices()
    return response.ok
  }

  // Sends a test, then follows it for up to ~30 s: queued -> accepted by the push service ->
  // displayed by this device. Each stage is reported only when it has really happened.
  const sendTest = async (): Promise<string | null> => {
    const response = await fetch('/api/push/test', { method: 'POST' })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      return body.error ?? 'Could not send a test notification'
    }
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await reloadDevices()
      setLastShownAt((await lastPushShownOnThisDevice())?.at ?? null)
      const mine = queryClient
        .getQueryData<DevicesResponse>(['push-devices', userId])
        ?.devices.find((d) => d.id === currentDeviceId())
      const shown = await lastPushShownOnThisDevice()
      if (
        mine?.latest_delivery &&
        mine.latest_delivery.status !== 'queued' &&
        mine.latest_delivery.status !== 'sending' &&
        (mine.latest_delivery.status !== 'sent' ||
          (shown &&
            Date.parse(shown.at) >=
              Date.parse(mine.latest_delivery.created_at) - 1000))
      )
        break
    }
    return null
  }

  const thisDevice = serverDevices?.find((d) => d.id === thisDeviceId)
  return {
    support,
    onHere,
    busy,
    devices: serverDevices ?? [],
    devicesError: devices.isError,
    // false until the server says this member is in the push pilot (fails closed)
    enrolled: devices.data?.enrolled === true,
    enrolledKnown: devices.data !== undefined,
    devicesLoading: devices.isLoading,
    thisDeviceId,
    diagnostics: {
      support,
      keyInApp: pushKeyStatus(),
      keyOnServer: devices.data?.keyOnServer ?? null,
      enrolled: devices.data ? devices.data.enrolled : null,
      permission,
      serviceWorkerActive,
      browserSubscribed,
      serverKnowsThisDevice,
      latestDelivery: thisDevice?.latest_delivery ?? null,
      lastShownAt,
    },
    refresh: async () => {
      await refreshLocal()
      await reloadDevices()
    },
    turnOn,
    turnOff,
    removeDevice,
    sendTest,
  }
}
