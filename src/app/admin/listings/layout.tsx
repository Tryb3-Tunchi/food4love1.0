import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminListingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('listings:manage'))) redirect('/admin')
  return children
}
