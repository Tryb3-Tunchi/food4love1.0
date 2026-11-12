import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  holdsPermission,
  type AdminPermission,
} from '@/lib/admin/intelligence/permissions'

export type { AdminPermission }

export async function getAdminUser(permission?: AdminPermission) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') return null
  if (permission) {
    const granted: unknown[] = Array.isArray(
      user.app_metadata?.admin_permissions,
    )
      ? user.app_metadata.admin_permissions
      : []
    if (!holdsPermission(granted, permission)) return null
  }

  return user
}

// For pages and routes that show different amounts of detail by permission.
export function adminPermissionsOf(user: {
  app_metadata?: Record<string, unknown>
}): string[] {
  const raw = user.app_metadata?.admin_permissions
  return Array.isArray(raw)
    ? raw.filter((p): p is string => typeof p === 'string')
    : []
}
