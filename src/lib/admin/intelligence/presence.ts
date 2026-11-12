// Pure module with NO imports so it can be unit-tested with node --test.

// A signed-in browser sends a heartbeat every 45 seconds while the tab is
// visible. Someone counts as "online" only if a heartbeat arrived in the last
// two minutes, which tolerates one missed beat. Closing the tab or switching
// away simply stops the beats, so the status expires by itself.
export const HEARTBEAT_SECONDS = 45
export const ONLINE_WINDOW_SECONDS = 120

export type PresenceBand = 'online' | '5m' | '15m' | '1h' | 'today' | 'earlier'

export function presenceBand(
  lastSeenMs: number,
  nowMs: number,
  startOfTodayMs: number,
): PresenceBand {
  const age = (nowMs - lastSeenMs) / 1000
  if (age < 0) return 'online' // small clock skew
  if (age <= ONLINE_WINDOW_SECONDS) return 'online'
  if (age <= 5 * 60) return '5m'
  if (age <= 15 * 60) return '15m'
  if (age <= 60 * 60) return '1h'
  if (lastSeenMs >= startOfTodayMs) return 'today'
  return 'earlier'
}

export interface PresenceCounts {
  online: number
  last5m: number
  last15m: number
  lastHour: number
  today: number
}

// Cumulative: someone online is also in "last 5 minutes", and so on.
export function summarisePresence(
  lastSeenMs: number[],
  nowMs: number,
  startOfTodayMs: number,
): PresenceCounts {
  const counts: PresenceCounts = {
    online: 0,
    last5m: 0,
    last15m: 0,
    lastHour: 0,
    today: 0,
  }
  for (const seen of lastSeenMs) {
    const band = presenceBand(seen, nowMs, startOfTodayMs)
    if (band === 'earlier') continue
    counts.today += 1
    if (band === 'today') continue
    counts.lastHour += 1
    if (band === '1h') continue
    counts.last15m += 1
    if (band === '15m') continue
    counts.last5m += 1
    if (band === '5m') continue
    counts.online += 1
  }
  return counts
}

// Human wording for the status chip.
export function presenceLabel(band: PresenceBand): string {
  switch (band) {
    case 'online':
      return 'Online now'
    case '5m':
      return 'Active 5 min ago'
    case '15m':
      return 'Active 15 min ago'
    case '1h':
      return 'Active within the hour'
    case 'today':
      return 'Active earlier today'
    default:
      return 'Offline'
  }
}
