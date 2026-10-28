import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminMessagesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('messages:manage'))) redirect('/admin')
  return children
}
