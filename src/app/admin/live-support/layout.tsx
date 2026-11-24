import { getAdminUser } from '@/lib/admin/auth'
import { redirect } from 'next/navigation'

export default async function LiveSupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('messages:manage'))) redirect('/admin')
  return children
}
