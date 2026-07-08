"use client";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  verified?: boolean;
}

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl", "2xl": "h-28 w-28 text-2xl" };

export function Avatar({ src, name, size = "md", className, verified }: AvatarProps) {
  const safeName = name ?? "";
  return (
    <div className="relative inline-flex">
      <AvatarPrimitive.Root className={cn("relative flex shrink-0 overflow-hidden rounded-full", sizes[size], className)}>
        <AvatarPrimitive.Image src={src ?? undefined} alt={safeName} className="h-full w-full object-cover" />
        <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ember to-pepper font-bold text-white">
          {getInitials(safeName)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-lime text-white text-[8px] font-bold">✓</span>
      )}
    </div>
  );
}
