import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/auth'

export default async function AdminKycLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAdminUser('kyc:review')
  if (!user) redirect('/admin')

  return children
}
