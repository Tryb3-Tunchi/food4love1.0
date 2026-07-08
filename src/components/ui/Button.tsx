"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/**
 * FOOD4LOVE BUTTON SYSTEM
 *
 * Philosophy (Stripe/Linear standard):
 * - Buttons feel physical. They have depth at rest, and compress on press.
 * - No gradients on primary actions. Flat colour + shadow = more premium.
 * - Border radius: pill for CTAs, rounded-xl for actions, rounded-lg for dense UI.
 * - Loading state preserves button width — no layout shift.
 * - Every state is designed: default, hover, active, focus, disabled.
 */

const buttonVariants = cva(
  // ── BASE ── applies to every variant
  [
    "relative inline-flex items-center justify-center",
    "font-semibold tracking-[-0.01em] leading-none",
    "select-none outline-none cursor-pointer",
    "transition-all duration-150 ease-out",
    // Press feel — physical compression
    "active:scale-[0.97] active:duration-75",
    // Focus ring — accessibility without ugliness
    "focus-visible:ring-2 focus-visible:ring-pepper/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        // ── PRIMARY — the main action. Red, confident, warm shadow.
        primary: [
          "bg-pepper text-white",
          "shadow-[0_1px_2px_rgba(232,57,14,0.3),0_4px_12px_rgba(232,57,14,0.2)]",
          "hover:bg-[#D4330C] hover:shadow-[0_1px_3px_rgba(232,57,14,0.4),0_6px_16px_rgba(232,57,14,0.25)]",
          "active:shadow-[0_1px_2px_rgba(232,57,14,0.2)]",
        ],

        // ── SECONDARY — supporting action. White, subtle border, lifts on hover.
        secondary: [
          "bg-card text-ink border border-border",
          "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
          "hover:bg-surface-muted hover:border-divider hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
          "active:bg-divider",
        ],

        // ── GHOST — tertiary. Invisible until hovered.
        ghost: [
          "bg-transparent text-body border border-transparent",
          "hover:bg-surface-muted hover:text-ink hover:border-border",
          "active:bg-divider",
        ],

        // ── EMBER — warmth. For secondary CTAs, match celebration, chef features.
        ember: [
          "bg-ember text-white",
          "shadow-[0_1px_2px_rgba(245,158,11,0.3),0_4px_12px_rgba(245,158,11,0.2)]",
          "hover:bg-[#E08F00] hover:shadow-[0_2px_8px_rgba(245,158,11,0.3)]",
        ],

        // ── OUTLINE — bordered. For secondary on dark backgrounds.
        outline: [
          "bg-transparent text-pepper border-2 border-pepper/30",
          "hover:bg-pepper/5 hover:border-pepper/50",
          "active:bg-pepper/10",
        ],

        // ── DARK — for use on light backgrounds. App navigation, etc.
        dark: [
          "bg-ink text-white border border-ink",
          "shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)]",
          "hover:bg-[#222222] hover:shadow-[0_2px_8px_rgba(0,0,0,0.25)]",
        ],

        // ── DANGER — destructive actions only. Never for regular UI.
        danger: [
          "bg-red-500 text-white",
          "shadow-[0_1px_2px_rgba(239,68,68,0.3)]",
          "hover:bg-red-600 hover:shadow-[0_2px_8px_rgba(239,68,68,0.3)]",
        ],

        // ── SURFACE — for cards and panels. Ultra subtle.
        surface: [
          "bg-surface-muted text-ink border border-border",
          "hover:bg-divider hover:border-border",
        ],
      },

      size: {
        // Compact — for dense UI, badges, tag actions
        xs: "h-7 px-3 text-xs rounded-lg gap-1",
        // Small — secondary actions in list items
        sm: "h-8 px-3.5 text-sm rounded-xl gap-1.5",
        // Default — most buttons in the app
        md: "h-10 px-4 text-sm rounded-xl gap-2",
        // Large — primary page CTAs
        lg: "h-12 px-6 text-base rounded-2xl gap-2",
        // XL — hero CTAs on landing page
        xl: "h-14 px-8 text-base rounded-full gap-2.5",
        // 2XL — big hero moments only
        "2xl": "h-16 px-10 text-lg rounded-full gap-3",
        // Icon buttons — square
        icon: "h-10 w-10 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
        "icon-lg": "h-12 w-12 rounded-2xl",
        "icon-xl": "h-14 w-14 rounded-2xl",
      },

      // Full width option
      fullWidth: {
        true: "w-full",
      },

      // Pill shape override — for landing CTAs
      pill: {
        true: "rounded-full",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

// Spinner component — preserved width during loading
function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // compatibility: allow `asChild` used elsewhere (no runtime special behavior)
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      pill,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size, fullWidth, pill }),
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Spinner />
            <span className="opacity-70">{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export { buttonVariants };
