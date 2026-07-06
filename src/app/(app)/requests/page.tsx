"use client";
import { useMatches } from "@/hooks/useMatches";
import { useAuthStore } from "@/stores/useAuthStore";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ChefHat, Shield } from "lucide-react";

export default function RequestsPage() {
  const profile = useAuthStore((s) => s.profile);
  const { data: matches, isLoading } = useMatches();

  const isUnverified = profile?.role === "cook" && profile?.kyc_status !== "verified";

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <ChefHat className="h-5 w-5 text-ember" />
        <h1 className="text-xl font-bold text-white">Requests</h1>
      </div>

      {isUnverified && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 mb-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-400">KYC verification pending</p>
            <p className="text-xs text-mist mt-0.5">You can chat with matches but cannot accept bookings until verified.</p>
            {profile?.kyc_status !== "pending" && (
              <Link href="/onboarding/kyc" className="mt-2 inline-block text-xs text-pepper underline">Complete verification →</Link>
            )}
          </div>
        </div>
      )}

      {isLoading ? <p className="text-mist text-sm">Loading...</p> :
        !matches?.length ? <EmptyState icon="🍳" title="No requests yet" description="Food lovers will appear here when they match with you." /> :
        <div className="space-y-2">
          {matches.map((m) => {
            const buyer = m.other_user;
            if (!buyer) return null;
            return (
              <Link key={m.id} href={`/chat/${m.id}`} className="flex items-center gap-3 rounded-2xl bg-smoke border border-white/5 p-4 hover:border-ember/20 transition-all">
                <Avatar src={buyer.avatar_url} name={buyer.full_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white block truncate">{buyer.full_name}</span>
                  <p className="text-sm text-mist truncate">{m.last_message?.content ?? "Wants to connect 👋"}</p>
                </div>
                {m.unread_count ? <Badge variant="default" size="sm" className="bg-pepper text-white border-0 shrink-0">{m.unread_count}</Badge> : null}
              </Link>
            );
          })}
        </div>
      }
    </div>
  );
}
