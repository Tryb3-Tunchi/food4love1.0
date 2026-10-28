import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminBookingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminUser('bookings:manage'))) redirect('/admin')
  return children
}
