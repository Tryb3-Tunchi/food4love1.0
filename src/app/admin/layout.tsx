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

  return <AdminThemeProvider>{children}</AdminThemeProvider>
}
