import { LegalIndex } from '@/components/legal/LegalDocumentView'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Legal information',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <LegalIndex />
}
