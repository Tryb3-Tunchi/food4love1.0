'use client'

import { useState } from 'react'
import { BubbleMap } from '@/components/admin/intelligence/BubbleMap'
import {
  BarList,
  CardGridSkeleton,
  ErrorPanel,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  StatusChip,
  Unavailable,
  countryName,
  fmt,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'

interface CountryRow {
  code: string
  visitors: number
  previous: number
  growth: number | null
  registered: number
  waitlist: number
}
type Geography =
  | { available: false; reason: string }
  | {
      available: true
      truncated: boolean
      estimatedFrom: string
      countries: CountryRow[]
      topCountries: CountryRow[]
      unknownVisitors: number
      topRegions: { code: string; visitors: number }[]
      regions: { code: string; visitors: number; registered: number }[] | null
      selectedCountry: string | null
      userProvided: { key: string; count: number }[]
    }

export default function GeographyPage() {
  const { value, setValue, params } = useRangeState('30d')
  const [country, setCountry] = useState<string | null>(null)
  const { data, error, loading, reload } = useAdminData<Geography>(
    'intelligence/geography',
    {
      ...params,
      country: country ?? undefined,
    },
  )
  const ok = data && data.available ? data : null

  return (
    <Page
      title="Geography"
      description="Where visitors and members come from. Locations are estimated from the connection when someone accepts analytics: country and region only, never an address, and never the IP itself."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={4} />}
      {data && !data.available && <Unavailable>{data.reason}</Unavailable>}
      {ok && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusChip tone="neutral">IP-estimated</StatusChip>
            <span className="text-[var(--admin-muted)]">
              {fmt(ok.unknownVisitors)} visitors have an unknown location and
              are not placed on the map.
            </span>
          </div>

          <Panel
            title="Visitors by country"
            hint="Click a country to see its regions"
          >
            <BubbleMap
              countries={ok.countries.map((c) => ({
                code: c.code,
                visitors: c.visitors,
              }))}
              selected={country}
              onSelect={(code) => setCountry(code === country ? null : code)}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Top 10 countries"
              hint="Visitors, with change against the previous period"
            >
              <BarList
                items={ok.topCountries.map((c) => ({
                  key: c.code,
                  label: countryName(c.code),
                  value: c.visitors,
                  sub: `${fmt(c.registered)} signed-in members · ${fmt(c.waitlist)} joined the waitlist${c.growth !== null ? ` · ${c.growth > 0 ? '+' : ''}${c.growth}% vs previous` : ''}`,
                }))}
                onSelect={(code) => setCountry(code === country ? null : code)}
                empty="No located visits in this period yet."
              />
            </Panel>

            <Panel
              title={
                country
                  ? `Regions in ${countryName(country)}`
                  : 'Top 10 regions'
              }
              hint={
                country
                  ? 'Visitors and signed-in members by region'
                  : 'Across all countries, where the region is known'
              }
            >
              {country && ok.regions ? (
                <BarList
                  items={ok.regions.map((r) => ({
                    key: r.code,
                    label: r.code === '??' ? 'Unknown region' : r.code,
                    value: r.visitors,
                    sub: `${fmt(r.registered)} signed-in members`,
                  }))}
                  empty="No regions recorded for this country."
                />
              ) : (
                <BarList
                  items={ok.topRegions.map((r) => ({
                    key: r.code,
                    label: r.code,
                    value: r.visitors,
                  }))}
                  empty="No regions recorded yet."
                />
              )}
              {country && (
                <button
                  type="button"
                  onClick={() => setCountry(null)}
                  className="mt-3 min-h-10 rounded-lg border border-[var(--admin-border)] px-3 text-sm font-semibold hover:bg-[var(--admin-hover)]"
                >
                  Back to all countries
                </button>
              )}
              <p className="mt-3 text-xs text-[var(--admin-muted)]">
                Region names are the short codes the connection provides, so
                some are unfamiliar. A region’s own breakdown (cities) is not
                collected, to keep locations coarse.
              </p>
            </Panel>
          </div>

          <Panel
            title="What members say about themselves"
            hint="Typed into their own profile, so it is user-provided and a different source from the connection estimate. Shown only when 3 or more members share a value."
          >
            <StatusChip tone="neutral">User-provided</StatusChip>
            <div className="mt-3">
              <BarList
                items={ok.userProvided.map((l) => ({
                  key: l.key,
                  label: l.key,
                  value: l.count,
                }))}
                empty="Not enough members share a location yet."
              />
            </div>
          </Panel>
          {ok.truncated && (
            <p className="text-xs text-[var(--admin-muted)]">
              Very large period: figures use the most recent 20,000 visits.
            </p>
          )}
        </>
      )}
    </Page>
  )
}
