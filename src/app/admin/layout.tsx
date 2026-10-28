import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAdminUser()
  if (!user) redirect('/login')
  const permissionClaims = user.app_metadata?.admin_permissions
  const permissions = Array.isArray(permissionClaims)
    ? permissionClaims.filter(
        (permission): permission is string => typeof permission === 'string',
      )
    : []

  return (
    <AdminThemeProvider permissions={permissions}>
      {children}
    </AdminThemeProvider>
  )
}
