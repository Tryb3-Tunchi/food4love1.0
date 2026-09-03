import { BookingForm } from '@/components/booking/BookingForm'

interface PageProps {
  searchParams: { cookId?: string; matchId?: string }
}

export default function NewBookingPage({ searchParams }: PageProps) {
  const cookId = searchParams.cookId
  const matchId = searchParams.matchId

  if (!cookId || !matchId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
        Missing cook or match information
      </div>
    )
  }

  return <BookingForm cookId={cookId} matchId={matchId} />
}
