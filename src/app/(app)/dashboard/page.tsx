import { redirect } from 'next/navigation'

// The dashboard moved. The "Today" strip lives on Discover and the business
// tools are under the Business tab on Profile.
export default function DashboardPage() {
  redirect('/swipe')
}
