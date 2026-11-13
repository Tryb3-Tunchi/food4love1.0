'use client'

import { projectCentre } from '@/lib/admin/intelligence/countries'
import { countryName, fmt } from './kit'

// A bubble map: one circle per country, sized by visitors. Circles are real
// buttons, so the map works with a keyboard and a screen reader, and the same
// numbers are always listed beside it. It shows countries, never exact places.
export function BubbleMap({
  countries,
  selected,
  onSelect,
}: {
  countries: { code: string; visitors: number }[]
  selected: string | null
  onSelect: (code: string) => void
}) {
  const plotted = countries.flatMap((c) => {
    const p = projectCentre(c.code)
    return p ? [{ ...c, ...p }] : []
  })
  const hidden =
    countries.filter((c) => c.code !== '??').length - plotted.length
  const max = Math.max(1, ...plotted.map((c) => c.visitors))

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)]"
        style={{ aspectRatio: '2 / 1' }}
      >
        <svg
          viewBox="0 0 360 180"
          className="absolute inset-0 h-full w-full"
          role="group"
          aria-label="Visitors by country"
        >
          {[...Array(11)].map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 36}
              x2={i * 36}
              y1="0"
              y2="180"
              stroke="var(--admin-border)"
              strokeWidth="0.4"
            />
          ))}
          {[...Array(5)].map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              x2="360"
              y1={i * 45}
              y2={i * 45}
              stroke="var(--admin-border)"
              strokeWidth="0.4"
            />
          ))}
          <line
            x1="0"
            x2="360"
            y1="90"
            y2="90"
            stroke="var(--admin-border)"
            strokeWidth="0.8"
          />
        </svg>
        {plotted.map((c) => {
          const size = 14 + Math.sqrt(c.visitors / max) * 34
          const active = selected === c.code
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onSelect(c.code)}
              aria-pressed={active}
              aria-label={`${countryName(c.code)}: ${fmt(c.visitors)} visitors`}
              title={`${countryName(c.code)}: ${fmt(c.visitors)} visitors`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${active ? 'border-[var(--admin-text)] bg-[var(--admin-accent)]' : 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]'}`}
              style={{
                left: `${(c.x / 360) * 100}%`,
                top: `${(c.y / 180) * 100}%`,
                width: size,
                height: size,
              }}
            />
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--admin-muted)]">
        Each circle sits at the centre of its country; bigger means more
        visitors.{' '}
        {hidden > 0 ? `${hidden} countries are listed but not drawn. ` : ''}
        Click a circle or a row to see its regions.
      </p>
    </div>
  )
}
