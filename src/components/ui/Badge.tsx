import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 font-medium transition-colors", {
  variants: {
    variant: {
      default:  "bg-pepper/10 text-pepper border border-pepper/20",
      ember:    "bg-ember/10 text-ember border border-ember/20",
      success:  "bg-lime/10 text-lime border border-lime/20",
      muted:    "bg-fog text-ash border border-fog dark:bg-coal dark:text-mist dark:border-coal",
      verified: "bg-lime text-white",
      new:      "bg-pepper text-white animate-pulse-glow",
    },
    size: {
      sm: "h-5 px-1.5 text-[10px] rounded-full",
      md: "h-6 px-2 text-xs rounded-full",
      lg: "h-7 px-3 text-sm rounded-full",
    },
  },
  defaultVariants: { variant: "default", size: "md" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
