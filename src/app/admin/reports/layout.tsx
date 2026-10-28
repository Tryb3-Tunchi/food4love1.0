import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('reports:manage'))) redirect('/admin')
  return children
}
