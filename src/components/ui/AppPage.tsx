"use client";
import { AmbientBackground } from "./AmbientBackground";
import { cn } from "@/lib/utils";

interface AppPageProps {
  children: React.ReactNode;
  className?: string;
  ambient?: "pepper" | "ember" | "green" | "mixed";
  ambientIntensity?: "low" | "medium" | "high";
  fullHeight?: boolean;
}

export function AppPage({
  children,
  className,
  ambient = "mixed",
  ambientIntensity = "low",
  fullHeight = false,
}: AppPageProps) {
  return (
    <div
      className={cn(
        "relative",
        fullHeight && "flex h-[100dvh] flex-col overflow-hidden"
      )}
      style={{ background: "var(--app-bg)" }}
    >
      <AmbientBackground variant={ambient} intensity={ambientIntensity} />
      <div
        className={cn(
          "relative z-10",
          fullHeight && "flex flex-1 flex-col overflow-hidden",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
