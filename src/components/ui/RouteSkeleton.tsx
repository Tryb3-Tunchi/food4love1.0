import { Skeleton } from '@/components/ui/Skeleton'

// Instant page shell shown by the route-level loading.tsx files while a page's code and data
// arrive. Shapes only: never names, numbers or other placeholder data that could be mistaken for
// real information. The bottom navigation lives in the layout, so it stays visible and the tapped
// tab highlights immediately.
type Variant = 'list' | 'deck' | 'chat' | 'profile' | 'form' | 'cards'

export function RouteSkeleton({
  variant = 'list',
  label = 'Loading',
}: {
  variant?: Variant
  label?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-md px-4 pb-28 pt-5"
    >
      <span className="sr-only">{label}</span>
      {/* header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>

      {variant === 'deck' && (
        <>
          <Skeleton className="aspect-[3/4] w-full rounded-[1.75rem]" />
          <div className="mt-5 flex justify-center gap-5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-14 w-14 rounded-full" />
          </div>
        </>
      )}

      {variant === 'list' && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'cards' && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {variant === 'chat' && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}
            >
              <Skeleton
                className={`h-10 rounded-2xl ${i % 2 ? 'w-1/2' : 'w-2/3'}`}
              />
            </div>
          ))}
        </div>
      )}

      {variant === 'profile' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {variant === 'form' && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  )
}
