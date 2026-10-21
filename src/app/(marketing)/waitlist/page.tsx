import type { Metadata } from 'next'
import { WaitlistLanding } from '@/components/landing/WaitlistLanding'

export const metadata: Metadata = {
  title: 'Join the Food4Love waitlist',
  description:
    'Get launch updates from Food4Love, connecting home cooks with people who love good food.',
}

export default function WaitlistPage() {
  return <WaitlistLanding />
}
