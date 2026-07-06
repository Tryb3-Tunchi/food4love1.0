"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";
import { AppTopBar } from "./AppTopBar";

const NO_CHROME = ["/login", "/signup", "/verify", "/onboarding", "/cook/"];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNoChrome = NO_CHROME.some((p) => pathname.startsWith(p));

  // Auth + onboarding — no nav, uses same theme vars
  if (isNoChrome) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          color: "var(--text-1)",
        }}
      >
        {children}
      </div>
    );
  }

  // Everything else — landing + all app pages — same theme vars
  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--text-1)",
      }}
    >
      <SidebarNav />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        className="md:ml-64"
      >
        <AppTopBar />
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div
            style={{
              maxWidth: "32rem",
              margin: "0 auto",
              minHeight: "100%",
              paddingBottom: "5rem",
            }}
          >
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
