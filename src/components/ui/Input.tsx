"use client";
import { cn } from "@/lib/utils";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leftIcon, rightElement, type, ...props },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label className="text-sm font-semibold leading-none text-ink">
            {label}
          </label>
        )}

        <div className="group relative">
          {/* Left icon */}
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 group-focus-within:text-pepper">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            className={cn(
              "f4l-input h-11 w-full text-sm placeholder:text-muted",
              leftIcon ? "pl-10" : "pl-3.5",
              isPassword || rightElement ? "pr-10" : "pr-3.5",
              "py-2.5",
              error && [
                "border-red-400/60 bg-red-50/30",
                "focus:border-red-400 focus:ring-red-400/15",
              ],
              className
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 hover:text-body"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Custom right element */}
          {rightElement && !isPassword && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {rightElement}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="flex items-center gap-1 text-xs font-medium text-red-500">
            <span>⚠</span> {error}
          </p>
        )}

        {/* Hint */}
        {hint && !error && <p className="text-ash text-xs">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
