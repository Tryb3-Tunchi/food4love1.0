import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {icon && <div className="mb-4 text-5xl">{icon}</div>}
      <h3 className="text-lg font-semibold" style={{ color: "var(--text-1)" }}>{title}</h3>
      {description && <p className="mt-1 text-sm max-w-xs" style={{ color: "var(--text-2)" }}>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
