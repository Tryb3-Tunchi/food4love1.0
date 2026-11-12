'use client'

import Link from 'next/link'
import { Page, Panel } from '@/components/admin/intelligence/kit'
import {
  ADMIN_ROLES,
  PERMISSION_LABELS,
  type AdminRoleKey,
} from '@/lib/admin/intelligence/permissions'

// Read-only on purpose: critical settings are changed in code review or in the
// Supabase and Vercel dashboards, where changes are logged by those tools.
export default function SettingsPage() {
  return (
    <Page
      title="Settings"
      description="How the admin console is set up. This page only explains; it changes nothing. Staff access is edited on its own audited page."
    >
      <Panel
        title="Roles"
        hint="A role is a ready-made set of permissions. Only a Super Admin can change anyone’s access."
      >
        <div className="space-y-4">
          {(Object.keys(ADMIN_ROLES) as AdminRoleKey[]).map((key) => (
            <div
              key={key}
              className="rounded-xl border border-[var(--admin-border)] p-3"
            >
              <p className="text-sm font-bold">{ADMIN_ROLES[key].label}</p>
              <p className="text-xs text-[var(--admin-muted)]">
                {ADMIN_ROLES[key].summary}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {ADMIN_ROLES[key].permissions.map((p) => (
                  <li
                    key={p}
                    className="rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[11px]"
                    title={p}
                  >
                    {PERMISSION_LABELS[p]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link
            href="/admin/access"
            className="font-semibold underline underline-offset-2"
          >
            Open Staff access
          </Link>{' '}
          to give someone a role. They need to sign out and in again for it to
          apply.
        </p>
      </Panel>

      <Panel title="Privacy of analytics">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--admin-muted)]">
          <li>
            Collection is OFF by default. The owner switches it on with
            NEXT_PUBLIC_ANALYTICS_ENABLED, after the policies are published.
          </li>
          <li>
            Nothing is collected until a visitor presses Accept on the privacy
            banner. A browser that sends Global Privacy Control is treated as a
            No.
          </li>
          <li>
            No IP addresses, device details, messages or form contents are
            stored.
          </li>
          <li>Only a page’s address is recorded, never its query string.</li>
          <li>
            Location is a coarse country and region estimate, never an address.
          </li>
          <li>
            Analytics older than 400 days is removed by the retention function
            once it is scheduled.
          </li>
          <li>The admin console itself is never tracked.</li>
        </ul>
      </Panel>

      <Panel title="Where other settings live">
        <ul className="space-y-1.5 text-sm text-[var(--admin-muted)]">
          <li>
            <span className="font-semibold text-[var(--admin-text)]">
              Email sender and keys:
            </span>{' '}
            Vercel environment variables (see System health for which are set).
          </li>
          <li>
            <span className="font-semibold text-[var(--admin-text)]">
              Database and row-level security:
            </span>{' '}
            the Supabase dashboard.
          </li>
          <li>
            <span className="font-semibold text-[var(--admin-text)]">
              Audit history:
            </span>{' '}
            <Link href="/admin/audit" className="underline underline-offset-2">
              Audit log
            </Link>
            . Once the prepared analytics migration is applied, records can be
            added to but never edited or deleted, even by staff.
          </li>
        </ul>
      </Panel>
    </Page>
  )
}
