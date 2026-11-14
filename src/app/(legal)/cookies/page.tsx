import { LegalPage, legalMetadata } from '@/components/legal/LegalDocumentView'
import { PrivacyChoices } from '@/components/legal/PrivacyChoices'
import {
  effectiveLegalVisibility,
  findLegalDocument,
} from '@/lib/legal/documents'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => legalMetadata('cookies')

export default function Page() {
  const doc = findLegalDocument('cookies')
  const held =
    !doc ||
    effectiveLegalVisibility(
      {
        LEGAL_PAGES_PUBLISHED: process.env.LEGAL_PAGES_PUBLISHED,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
      doc,
    ) === 'held'
  return (
    <LegalPage slug="cookies">{held ? null : <PrivacyChoices />}</LegalPage>
  )
}
