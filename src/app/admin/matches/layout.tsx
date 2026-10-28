import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminMatchesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('matches:manage'))) redirect('/admin')
  return children
}
