import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminAccessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('admin:manage'))) redirect('/admin')
  return children
}
