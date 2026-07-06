import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-fog dark:bg-coal", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl">
      <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      <div className="mt-3 space-y-2 px-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2",
            i % 2 === 0 ? "justify-start" : "justify-end"
          )}
        >
          {i % 2 === 0 && (
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          )}
          <Skeleton
            className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")}
          />
        </div>
      ))}
    </div>
  );
}
