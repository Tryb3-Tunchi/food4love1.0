import 'server-only'
import { createClient } from '@/lib/supabase/server'

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

export async function getAdminUser(permission?: AdminPermission) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') return null
  if (
    permission &&
    (!Array.isArray(user.app_metadata?.admin_permissions) ||
      !user.app_metadata.admin_permissions.includes(permission))
  ) {
    return null
  }

  return user
}
