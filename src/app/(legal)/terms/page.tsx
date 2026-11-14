import { LegalPage, legalMetadata } from '@/components/legal/LegalDocumentView'

// Rendered on every request so the "held until approved" rule reads the live setting.
export const dynamic = 'force-dynamic'
export const generateMetadata = () => legalMetadata('terms')

export default function Page() {
  return <LegalPage slug="terms" />
}
