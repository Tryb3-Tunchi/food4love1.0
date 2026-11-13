// Pure module with NO imports so it can be unit-tested with node --test.

export interface RetentionRow {
  cohortStart: string // ISO start of the cohort window
  size: number // members who joined in that window
  // retained[k] = share (0-100) of the cohort active in window (cohort + k).
  // null = that window has not finished yet, so it cannot be judged.
  retained: (number | null)[]
}

// Cohort retention: group members by the window they joined in, then ask what
// share of each group was active in each later window. "Active" means the
// member did something recorded (a swipe, message or booking).
export function computeRetention(input: {
  members: { id: string; joinedMs: number }[]
  activity: { id: string; ms: number }[]
  firstWindowStartMs: number
  windowMs: number
  windowCount: number
  nowMs: number
}): RetentionRow[] {
  const {
    members,
    activity,
    firstWindowStartMs,
    windowMs,
    windowCount,
    nowMs,
  } = input

  const windowOf = (ms: number) =>
    Math.floor((ms - firstWindowStartMs) / windowMs)

  const cohorts: Set<string>[] = Array.from(
    { length: windowCount },
    () => new Set<string>(),
  )
  for (const member of members) {
    const w = windowOf(member.joinedMs)
    if (w >= 0 && w < windowCount) cohorts[w].add(member.id)
  }

  // active[w] = members with any activity in window w
  const active: Set<string>[] = Array.from(
    { length: windowCount },
    () => new Set<string>(),
  )
  for (const item of activity) {
    const w = windowOf(item.ms)
    if (w >= 0 && w < windowCount) active[w].add(item.id)
  }

  return cohorts.map((cohort, start) => {
    const retained: (number | null)[] = []
    for (let k = 0; start + k < windowCount; k += 1) {
      const windowEnd = firstWindowStartMs + (start + k + 1) * windowMs
      if (windowEnd > nowMs + windowMs) {
        retained.push(null)
        continue
      }
      // A window still in progress is shown, but the figure is partial.
      if (cohort.size === 0) {
        retained.push(null)
        continue
      }
      let still = 0
      cohort.forEach((id) => {
        if (active[start + k].has(id)) still += 1
      })
      retained.push(Math.round((still / cohort.size) * 1000) / 10)
    }
    return {
      cohortStart: new Date(
        firstWindowStartMs + start * windowMs,
      ).toISOString(),
      size: cohort.size,
      retained,
    }
  })
}
