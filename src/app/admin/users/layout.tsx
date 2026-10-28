import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('users:manage'))) redirect('/admin')
  return children
}
