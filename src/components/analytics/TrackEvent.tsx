'use client'

import { useEffect } from 'react'
import { track, type AnalyticsEventName } from '@/lib/analytics/client'

// Drop into any page to record ONE event when it opens. Does nothing unless the
// visitor accepted analytics (the check lives inside track()).
export function TrackEvent({ name }: { name: AnalyticsEventName }) {
  useEffect(() => {
    track(name)
  }, [name])
  return null
}
