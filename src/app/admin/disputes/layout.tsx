import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminDisputesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('disputes:manage'))) redirect('/admin')
  return children
}
