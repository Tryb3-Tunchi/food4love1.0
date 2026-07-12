import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-medium transition-all',
  {
    variants: {
      variant: {
        default: 'bg-pepper/10 text-pepper border border-pepper/20',
        pepper: 'bg-pepper/10 text-pepper border border-pepper/20',
        ember: 'bg-ember/10 text-ember border border-ember/25',
        lime: 'bg-lime/10 text-lime border border-lime/25',
        success: 'bg-lime/10 text-lime border border-lime/25',
        warning: 'bg-ember/10 text-ember border border-ember/25',
        muted: 'bg-surface-muted text-body border border-border',
        verified: 'bg-lime text-white border border-lime',
        new: 'bg-pepper text-white animate-pulse-soft',
      },
      size: {
        xs: 'h-5 px-1.5 text-[10px] rounded-full',
        sm: 'h-6 px-2 text-xs rounded-full',
        md: 'h-7 px-3 text-sm rounded-full',
        lg: 'h-8 px-4 text-sm rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}
