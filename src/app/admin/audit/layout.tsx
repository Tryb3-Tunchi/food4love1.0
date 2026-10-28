import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminAuditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('audit:view'))) redirect('/admin')
  return children
}
