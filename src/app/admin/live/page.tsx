'use client'

import {
  CardGridSkeleton,
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  StatusChip,
  Unavailable,
  fmt,
  fmtAgo,
  fmtDate,
  useAdminData,
} from '@/components/admin/intelligence/kit'

interface Person {
  id: string
  name: string
  avatarUrl: string | null
  accountType: string
  registeredAt: string
  lastSeenAt: string
  status: string
  online: boolean
  area: string
}
interface Recent {
  id: string
  name: string
  avatarUrl: string | null
  accountType: string
  registeredAt: string
}
type Live =
  | { available: false; reason: string }
  | {
      available: true
      onlineWindowSeconds: number
      counts: {
        online: number
        last5m: number
        last15m: number
        lastHour: number
        today: number
      }
      returningToday: number
      recentRegistrations: number
      people?: Person[]
      recentlyRegistered?: Recent[]
      canSeePeople: boolean
      generatedAt: string
    }

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--admin-accent-soft)] text-sm font-bold text-[var(--admin-accent)]"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function LiveActivityPage() {
  const { data, error, loading, reload } = useAdminData<Live>(
    'intelligence/live',
    {},
    20_000,
  )

  return (
    <Page
      title="Live activity"
      description="Who is on Food4Love right now. A member counts as online only while their open tab keeps checking in; it expires by itself two minutes after they leave."
      actions={
        <>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-muted)]">
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
            />
            Updates every 20 seconds
          </span>
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={7} />}
      {data && !data.available && <Unavailable>{data.reason}</Unavailable>}

      {data && data.available && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Online now" value={data.counts.online} strong />
            <Tile
              label="Active in the last 5 minutes"
              value={data.counts.last5m}
            />
            <Tile
              label="Active in the last 15 minutes"
              value={data.counts.last15m}
            />
            <Tile
              label="Active in the last hour"
              value={data.counts.lastHour}
            />
            <Tile label="Active earlier today" value={data.counts.today} />
            <Tile label="Returning members today" value={data.returningToday} />
            <Tile
              label="Joined in the last 7 days"
              value={data.recentRegistrations}
            />
          </div>

          <p className="text-xs text-[var(--admin-muted)]">
            Counts include only members who accepted analytics on this device.
            Private messages, exact locations and page details are never shown.
          </p>

          {!data.canSeePeople ? (
            <Panel title="Who is online">
              <p className="text-sm text-[var(--admin-muted)]">
                Your staff access shows totals only. Names appear for staff with
                the “see who is online” permission.
              </p>
            </Panel>
          ) : (
            <>
              <Panel title="Members active today" hint="Most recent first">
                {data.people && data.people.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                        <tr>
                          <th className="py-2 pr-3">Member</th>
                          <th className="py-2 pr-3">Account type</th>
                          <th className="py-2 pr-3">Registered</th>
                          <th className="py-2 pr-3">Last active</th>
                          <th className="py-2 pr-3">Where</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.people.map((p) => (
                          <tr
                            key={p.id}
                            className="border-[var(--admin-border)]/60 border-b"
                          >
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar url={p.avatarUrl} name={p.name} />
                                <span className="font-medium">{p.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">{p.accountType}</td>
                            <td className="py-2.5 pr-3">
                              {fmtDate(p.registeredAt)}
                            </td>
                            <td className="py-2.5 pr-3">
                              {fmtAgo(p.lastSeenAt)}
                            </td>
                            <td className="py-2.5 pr-3">{p.area}</td>
                            <td className="py-2.5">
                              <StatusChip tone={p.online ? 'ok' : 'neutral'}>
                                {p.status}
                              </StatusChip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--admin-muted)]">
                    Nobody has checked in today yet.
                  </p>
                )}
              </Panel>

              <Panel
                title="Recently registered"
                hint="Joined in the last 7 days"
              >
                {data.recentlyRegistered && data.recentlyRegistered.length ? (
                  <ul className="divide-[var(--admin-border)]/60 divide-y">
                    {data.recentlyRegistered.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <Avatar url={p.avatarUrl} name={p.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.name}
                          </p>
                          <p className="text-xs text-[var(--admin-muted)]">
                            {p.accountType} · joined {fmtAgo(p.registeredAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--admin-muted)]">
                    No new members this week.
                  </p>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </Page>
  )
}

function Tile({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs font-semibold text-[var(--admin-muted)]">{label}</p>
      <p
        className={`mt-2 font-display font-bold tracking-tight ${strong ? 'text-4xl text-[var(--admin-accent)]' : 'text-3xl'}`}
      >
        {fmt(value)}
      </p>
    </div>
  )
}
