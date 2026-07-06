"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Heart, MessageCircle, User, Map } from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useAuthStore } from "@/stores/useAuthStore";

const buyerNav = [
  { href: "/swipe", icon: Flame, label: "Discover" },
  { href: "/matches", icon: Heart, label: "Matches" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/map", icon: Map, label: "Map" },
  { href: "/profile", icon: User, label: "Me" },
];
const cookNav = [
  { href: "/requests", icon: Flame, label: "Requests" },
  { href: "/matches", icon: Heart, label: "Matches" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/profile", icon: User, label: "Me" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { unreadMessages, newMatches } = useNotificationStore();
  const profile = useAuthStore((s) => s.profile);
  const nav = profile?.role === "cook" ? cookNav : buyerNav;

  return (
    <nav
      className="safe-bottom f4l-nav fixed bottom-0 left-0 right-0 z-30 border-t md:hidden"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge =
            href === "/chat"
              ? unreadMessages
              : href === "/matches"
                ? newMatches
                : 0;

          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all"
              style={{
                color: active ? "var(--pepper)" : "var(--nav-icon-dim)",
              }}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: "var(--pepper)" }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ opacity: active ? 1 : 0.6 }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
