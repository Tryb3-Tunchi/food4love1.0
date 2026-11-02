import WalletTopupVerification from '@/components/profile/WalletTopupVerification'

export default function WalletVerifyPage({
  searchParams,
}: {
  searchParams: { reference?: string }
}) {
  return <WalletTopupVerification reference={searchParams.reference ?? ''} />
}
