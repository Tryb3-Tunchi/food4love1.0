"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  right?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "#E8390E",
  iconBg = "rgba(232,57,14,0.12)",
  right,
  badge,
  badgeColor = "#E8390E",
  className,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "mb-6 flex shrink-0 items-center justify-between",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: iconBg }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: iconColor }}
              strokeWidth={2.5}
            />
          </div>
        )}
        <div>
          <h1
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--app-text-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <span
            className="ml-1 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{
              background: `${badgeColor}18`,
              color: badgeColor,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </motion.div>
  );
}
