// Pure module (no framework imports) so it can be unit-tested with node --test.

export type AdminPermission =
  | 'kyc:review'
  | 'users:manage'
  | 'matches:manage'
  | 'disputes:manage'
  | 'audit:view'
  | 'bookings:manage'
  | 'finance:refund'
  | 'listings:manage'
  | 'messages:manage'
  | 'reports:manage'
  | 'admin:manage'
  // Added by the Intelligence Center:
  | 'analytics:view'
  | 'presence:view'
  | 'waitlist:manage'
  | 'waitlist:export'
  | 'users:view_email'
  | 'system:view'
  | 'email:manage'

export const LEGACY_PERMISSIONS: AdminPermission[] = [
  'kyc:review',
  'users:manage',
  'matches:manage',
  'disputes:manage',
  'audit:view',
  'bookings:manage',
  'finance:refund',
  'listings:manage',
  'messages:manage',
  'reports:manage',
  'admin:manage',
]

export const INTELLIGENCE_PERMISSIONS: AdminPermission[] = [
  'analytics:view',
  'presence:view',
  'waitlist:manage',
  'waitlist:export',
  'users:view_email',
  'system:view',
  'email:manage',
]

export const ALL_PERMISSIONS: AdminPermission[] = [
  ...LEGACY_PERMISSIONS,
  ...INTELLIGENCE_PERMISSIONS,
]

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  'kyc:review': 'Review chef verification',
  'users:manage': 'Manage users and accounts',
  'matches:manage': 'Manage matches',
  'disputes:manage': 'Resolve disputes',
  'audit:view': 'View the audit log',
  'bookings:manage': 'Manage bookings',
  'finance:refund': 'Request refunds',
  'listings:manage': 'Moderate meal listings',
  'messages:manage': 'Support inbox and announcements',
  'reports:manage': 'Handle reports',
  'admin:manage': 'Manage staff access (Super Admin)',
  'analytics:view': 'View aggregate analytics',
  'presence:view': 'See who is online (names)',
  'waitlist:manage': 'View the waitlist',
  'waitlist:export': 'Export the waitlist to CSV',
  'users:view_email': 'See member email addresses',
  'system:view': 'View system health and settings',
  'email:manage': 'Monitor and retry transactional email',
}

export type AdminRoleKey =
  | 'super_admin'
  | 'operations_admin'
  | 'support_admin'
  | 'analytics_viewer'
  | 'moderation_admin'

export const ADMIN_ROLES: Record<
  AdminRoleKey,
  { label: string; summary: string; permissions: AdminPermission[] }
> = {
  super_admin: {
    label: 'Super Admin',
    summary: 'Everything, including changing staff access.',
    permissions: ALL_PERMISSIONS,
  },
  operations_admin: {
    label: 'Operations Admin',
    summary: 'Runs day-to-day operations, waitlist, email and system health.',
    permissions: [
      'analytics:view',
      'presence:view',
      'users:manage',
      'matches:manage',
      'bookings:manage',
      'listings:manage',
      'disputes:manage',
      'reports:manage',
      'waitlist:manage',
      'email:manage',
      'system:view',
      'audit:view',
    ],
  },
  support_admin: {
    label: 'Support Admin',
    summary: 'Helps members: support inbox, bookings and disputes.',
    permissions: [
      'analytics:view',
      'messages:manage',
      'bookings:manage',
      'disputes:manage',
      'users:view_email',
    ],
  },
  analytics_viewer: {
    label: 'Analytics Viewer',
    summary: 'Aggregate statistics only. Cannot act on any account.',
    permissions: ['analytics:view'],
  },
  moderation_admin: {
    label: 'Moderation Admin',
    summary: 'Reports, verification, listings and account moderation.',
    permissions: [
      'analytics:view',
      'reports:manage',
      'kyc:review',
      'listings:manage',
      'users:manage',
    ],
  },
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return (
    typeof value === 'string' && (ALL_PERMISSIONS as string[]).includes(value)
  )
}

// Existing permissions keep their exact-match behaviour. The permissions added
// by the Intelligence Center are also implied by `admin:manage` (Super Admin),
// so the current owner does not need to re-grant themselves anything.
export function holdsPermission(
  granted: readonly unknown[],
  needed: AdminPermission,
): boolean {
  if (granted.includes(needed)) return true
  return (
    INTELLIGENCE_PERMISSIONS.includes(needed) &&
    granted.includes('admin:manage')
  )
}

// Which preset (if any) exactly matches a permission list.
export function roleForPermissions(
  granted: readonly unknown[],
): AdminRoleKey | null {
  const set = new Set(granted.filter(isAdminPermission))
  const keys = Object.keys(ADMIN_ROLES) as AdminRoleKey[]
  for (const key of keys) {
    const want = ADMIN_ROLES[key].permissions
    if (want.length === set.size && want.every((p) => set.has(p))) return key
  }
  return null
}
