'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  type EnableResult,
  browserSubscription,
  currentDeviceId,
  disablePush,
  enablePush,
  pushSupport,
} from '@/lib/push/client'
import type { PushSupport } from '@/lib/push/support'

export interface PushDevice {
  id: string
  label: string | null
  platform: string
  installed: boolean
  created_at: string
  last_success_at: string | null
}

async function loadDevices(): Promise<{
  devices: PushDevice[]
  enrolled: boolean
}> {
  const response = await fetch('/api/push/subscriptions', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load devices')
  const body = (await response.json()) as {
    devices?: PushDevice[]
    enrolled?: boolean
  }
  return { devices: body.devices ?? [], enrolled: body.enrolled === true }
}

export function usePushNotifications() {
  const userId = useAuthStore((state) => state.profile?.id ?? null)
  const queryClient = useQueryClient()
  const [support, setSupport] = useState<PushSupport | 'checking'>('checking')
  const [onHere, setOnHere] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshLocal = useCallback(async () => {
    setSupport(pushSupport())
    const subscription = await browserSubscription().catch(() => null)
    setOnHere(Boolean(subscription) && currentDeviceId() !== null)
  }, [])

  useEffect(() => {
    void refreshLocal()
  }, [refreshLocal])

  const devices = useQuery({
    queryKey: ['push-devices', userId],
    queryFn: loadDevices,
    enabled: !!userId,
  })
  const reloadDevices = () =>
    queryClient.invalidateQueries({ queryKey: ['push-devices', userId] })

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

  const sendTest = async (): Promise<string | null> => {
    const response = await fetch('/api/push/test', { method: 'POST' })
    if (response.ok) return null
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    return body.error ?? 'Could not send a test notification'
  }

  return {
    support,
    onHere,
    busy,
    devices: devices.data?.devices ?? [],
    // false until the server says this member is in the push pilot (fails closed)
    enrolled: devices.data?.enrolled === true,
    devicesLoading: devices.isLoading,
    thisDeviceId: typeof window === 'undefined' ? null : currentDeviceId(),
    turnOn,
    turnOff,
    removeDevice,
    sendTest,
  }
}
