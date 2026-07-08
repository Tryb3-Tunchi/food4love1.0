"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";
import { AppTopBar } from "./AppTopBar";

const NO_CHROME = ["/login", "/signup", "/verify", "/onboarding", "/cook/"];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNoChrome = NO_CHROME.some((p) => pathname.startsWith(p));

  if (isNoChrome) {
    return (
      <div className="min-h-dvh bg-[color:var(--bg)] text-[color:var(--text-1)]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh overflow-hidden bg-[color:var(--bg)] text-[color:var(--text-1)]">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <AppTopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-6">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
