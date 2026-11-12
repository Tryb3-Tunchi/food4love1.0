import 'server-only'
import {
  ONLINE_WINDOW_SECONDS,
  describePath,
  presenceBand,
  presenceLabel,
  summarisePresence,
} from '../presence'
import { startOfAdminDay } from '../dateRange'
import {
  DataError,
  fetchRows,
  headCount,
  realUsers,
  type Admin,
  type AnyQuery,
} from './core'

interface PresenceRow {
  user_id: string
  last_seen_at: string
  first_seen_at: string
  path: string | null
}
interface ProfileRow {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  created_at: string
}

const roleLabel = (role: string | null) =>
  role === 'cook' ? 'Chef' : role === 'buyer' ? 'Food lover' : 'Member'

// Who is on Food4Love right now. Names and photos are included ONLY when the
// caller holds presence:view; everyone else gets counts.
export async function getLive(admin: Admin, canSeePeople: boolean) {
  const now = Date.now()
  const todayStart = startOfAdminDay(now)
  const week = new Date(now - 7 * 24 * 3600 * 1000).toISOString()

  try {
    const presence = await fetchRows<PresenceRow>(
      admin,
      'user_presence',
      'user_id, last_seen_at, first_seen_at, path',
      {
        from: new Date(todayStart).toISOString(),
        column: 'last_seen_at',
        cap: 500,
      },
    )
    const counts = summarisePresence(
      presence.rows.map((r) => Date.parse(r.last_seen_at)),
      now,
      todayStart,
    )
    const returningToday = presence.rows.filter(
      (r) => Date.parse(r.first_seen_at) < todayStart,
    ).length

    const recentCount = await headCount(admin, 'profiles', {
      apply: realUsers as (q: AnyQuery) => AnyQuery,
      from: week,
    })

    let people: unknown[] | undefined
    let recentlyRegistered: unknown[] | undefined
    if (canSeePeople) {
      const ids = presence.rows.slice(0, 100).map((r) => r.user_id)
      const [profiles, recent] = await Promise.all([
        ids.length
          ? admin
              .from('profiles')
              .select('id, full_name, avatar_url, role, created_at')
              .in('id', ids)
          : Promise.resolve({ data: [] as ProfileRow[], error: null }),
        fetchRows<ProfileRow>(
          admin,
          'profiles',
          'id, full_name, avatar_url, role, created_at',
          {
            apply: realUsers as (q: AnyQuery) => AnyQuery,
            from: week,
            cap: 10,
          },
        ),
      ])
      const byId = new Map(
        ((profiles.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
      )
      people = presence.rows.slice(0, 100).flatMap((row) => {
        const profile = byId.get(row.user_id)
        if (!profile) return []
        const band = presenceBand(Date.parse(row.last_seen_at), now, todayStart)
        return [
          {
            id: profile.id,
            name: profile.full_name || 'Food4Love member',
            avatarUrl: profile.avatar_url,
            accountType: roleLabel(profile.role),
            registeredAt: profile.created_at,
            lastSeenAt: row.last_seen_at,
            status: presenceLabel(band),
            online: band === 'online',
            area: describePath(row.path),
          },
        ]
      })
      recentlyRegistered = recent.rows.map((p) => ({
        id: p.id,
        name: p.full_name || 'Food4Love member',
        avatarUrl: p.avatar_url,
        accountType: roleLabel(p.role),
        registeredAt: p.created_at,
      }))
    }

    return {
      available: true as const,
      onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
      counts,
      returningToday,
      recentRegistrations: recentCount,
      people,
      recentlyRegistered,
      canSeePeople,
      generatedAt: new Date(now).toISOString(),
    }
  } catch (error) {
    if (error instanceof DataError && error.missing) {
      return {
        available: false as const,
        reason:
          'Presence tracking is not switched on yet. Apply the analytics migration; members then appear here once they accept analytics.',
      }
    }
    throw error
  }
}
