"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, MapPin, BadgeCheck, Clock, Users, Flame,
  Share2, Settings, ChevronRight, Calendar,
  MessageCircle, Heart, Camera, Edit3, Shield,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { formatNaira } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const TABS = ["Overview", "Specials", "Reviews", "Info"] as const;
type Tab = typeof TABS[number];

const MOCK_REVIEWS = [
  { id:1, reviewer:"Tunde A.", rating:5, comment:"Absolutely incredible Ofe Akwu. My whole family loved it.", date:"2 weeks ago", avatar:"🧑🏿" },
  { id:2, reviewer:"Chisom N.", rating:5, comment:"Fresh pounded yam, generous portions. Will order again.", date:"1 month ago", avatar:"👩🏾" },
  { id:3, reviewer:"Emeka O.", rating:4, comment:"Solid food, good value. The Ofe Onugbu was the standout.", date:"1 month ago", avatar:"👨🏿" },
];

const MOCK_SPECIALS = [
  { id:1, title:"Ofe Akwu + Pounded Yam", desc:"Palm fruit soup, assorted protein, fresh pounded yam.", price:9500, emoji:"🍲", available:true },
  { id:2, title:"Ofe Nsala Special",       desc:"White soup with fresh catfish and pounded yam.",        price:11000, emoji:"🍜", available:true },
  { id:3, title:"Sunday Egusi Package",    desc:"Egusi soup for 4, with assorted meats and starch.",     price:18000, emoji:"🥘", available:false },
];

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl px-4 py-3 flex-1"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-semibold text-center leading-tight" style={{ color: "var(--text-2)" }}>{label}</span>
    </div>
  );
}

function SkeletonLine({ w = "100%", h = "1rem" }: { w?: string; h?: string }) {
  return <div className="f4l-skeleton rounded-lg" style={{ width: w, height: h }} />;
}

export default function ProfilePage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>("Overview");
  const [editing, setEditing] = useState(false);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  const handleShare = () => {
    if (profile) {
      navigator.clipboard.writeText(`${window.location.origin}/cook/${profile.id}`);
      toast.success("Profile link copied!");
    }
  };

  if (!profile) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLine h="8rem" />
        <SkeletonLine w="60%" h="1.5rem" />
        <SkeletonLine w="40%" />
        <SkeletonLine h="6rem" />
      </div>
    );
  }

  const isCook = profile.role === "cook";
  const isVerified = profile.kyc_status === "verified";
  const ratingDisplay = (profile.rating ?? 4.8).toFixed(1);

  return (
    <div className="pb-24" style={{ background: "var(--bg)" }}>
      {/* ── Hero ── */}
      <div className="relative">
        {/* Cover */}
        <div
          className="h-36 w-full relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--accent-l), var(--divider))" }}
        >
          {/* Decorative food pattern */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="text-8xl">
              {isCook ? "🍲" : "🍽️"}
            </span>
          </div>
          {isCook && (
            <button className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.85)", color: "var(--text-2)" }}>
              <Camera className="h-3.5 w-3.5" />
              Edit cover
            </button>
          )}
        </div>

        {/* Avatar row */}
        <div className="px-4 pb-0">
          <div className="flex items-end justify-between -mt-10 mb-3">
            {/* Avatar */}
            <div className="relative">
              <div
                className="h-20 w-20 rounded-2xl border-4 flex items-center justify-center text-4xl shadow-lift"
                style={{ background: "var(--card)", borderColor: "var(--card)" }}
              >
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover rounded-xl" />
                  : <span>{isCook ? "🧑‍🍳" : "🧑"}</span>
                }
              </div>
              {isVerified && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white"
                  style={{ background: "var(--success)" }}>
                  <BadgeCheck className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-1">
              <button onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <Share2 className="h-4 w-4" style={{ color: "var(--text-2)" }} />
              </button>
              <button onClick={() => setEditing(!editing)}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <Edit3 className="h-4 w-4" style={{ color: "var(--text-2)" }} />
              </button>
              <button onClick={() => router.push("/settings")}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <Settings className="h-4 w-4" style={{ color: "var(--text-2)" }} />
              </button>
            </div>
          </div>

          {/* Name + meta */}
          <h1 className="font-heading text-2xl font-bold mb-0.5" style={{ color: "var(--text-1)" }}>
            {profile.full_name}
          </h1>
          <p className="text-sm font-medium capitalize mb-1.5" style={{ color: "var(--accent)" }}>
            {isCook ? "Home Chef" : "Food Lover"}
          </p>

          {profile.location && (
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-3)" }} />
              <span className="text-sm" style={{ color: "var(--text-3)" }}>{profile.location}</span>
              {profile.streak && profile.streak > 1 && (
                <span className="flex items-center gap-0.5 ml-2 text-xs font-bold" style={{ color: "var(--warning)" }}>
                  <Flame className="h-3 w-3" style={{ color: "#F59E0B" }} />
                  {profile.streak}d streak
                </span>
              )}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-2)" }}>
              {profile.bio}
            </p>
          )}

          {/* KYC banner for cooks */}
          {isCook && profile.kyc_status !== "verified" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-3 mb-4 flex items-center gap-3"
              style={{ background: profile.kyc_status === "pending" ? "rgba(255,217,102,0.15)" : "rgba(214,69,69,0.08)", border: `1px solid ${profile.kyc_status === "pending" ? "rgba(255,217,102,0.4)" : "rgba(214,69,69,0.2)"}` }}
            >
              <Shield className="h-5 w-5 shrink-0" style={{ color: profile.kyc_status === "pending" ? "#8B6914" : "var(--danger)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: profile.kyc_status === "pending" ? "#8B6914" : "var(--danger)" }}>
                  {profile.kyc_status === "pending" ? "KYC under review — usually 24–48h" : "Verify your identity to start selling"}
                </p>
                {profile.kyc_status !== "pending" && (
                  <button onClick={() => router.push("/onboarding/kyc")} className="text-xs font-semibold mt-0.5" style={{ color: "var(--danger)" }}>
                    Complete verification →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Stats row — cook only */}
          {isCook && (
            <div className="flex gap-2 mb-5">
              <StatPill icon="⭐" label={`${ratingDisplay} Rating`} />
              <StatPill icon="🍽" label={`${profile.review_count ?? 0} Reviews`} />
              <StatPill icon="💬" label="< 1h Reply" />
            </div>
          )}

          {/* Cuisines */}
          {isCook && profile.cuisines && profile.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {profile.cuisines.map((c) => (
                <span key={c} className="f4l-badge f4l-badge-accent">{c}</span>
              ))}
            </div>
          )}

          {/* Price range — cook only */}
          {isCook && profile.price_min && (
            <div className="rounded-2xl p-4 mb-5 flex items-center justify-between"
              style={{ background: "rgba(232,116,40,0.06)", border: "1px solid rgba(232,116,40,0.15)" }}>
              <div>
                <p className="f4l-section-label mb-1">Price range</p>
                <p className="font-heading text-xl font-bold" style={{ color: "var(--text-1)" }}>
                  {formatNaira(profile.price_min)}{profile.price_max ? ` – ${formatNaira(profile.price_max)}` : "+"}
                </p>
              </div>
              <button
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                style={{ background: "var(--accent)", boxShadow: "0 4px 20px rgba(232,116,40,0.3)" }}
              >
                <Calendar className="h-4 w-4" />
                Book
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Tabs ── */}
      <div className="sticky top-0 z-20 px-4 pt-2 pb-0"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--divider)" }}>
        <div className="flex gap-1">
          {(isCook ? TABS : (["Overview","Info"] as Tab[])).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-4 py-3 text-sm font-semibold transition-all"
              style={{ color: tab === t ? "var(--accent)" : "var(--text-3)" }}
            >
              {t}
              {tab === t && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="px-4 pt-5"
        >
          {tab === "Overview" && (
            <div className="space-y-5">
              {/* About section */}
              <div>
                <p className="f4l-section-label mb-3">About</p>
                <div className="f4l-card p-4">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {profile.bio ?? "No bio yet. Tap edit to add one."}
                  </p>
                </div>
              </div>

              {/* Quick stats for cook */}
              {isCook && (
                <div>
                  <p className="f4l-section-label mb-3">Details</p>
                  <div className="f4l-card divide-y" style={{ borderColor: "var(--divider)" }}>
                    {[
                      { label: "Availability", value: "Mon–Sat · 12pm–8pm", icon: Clock },
                      { label: "Serves", value: "1–6 people", icon: Users },
                      { label: "Response time", value: "Usually within 1 hour", icon: MessageCircle },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 p-4">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                        <div className="flex-1">
                          <p className="text-xs" style={{ color: "var(--text-3)" }}>{label}</p>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referral for all users */}
              <div>
                <p className="f4l-section-label mb-3">Share & Earn</p>
                <div className="f4l-card p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--accent-l)" }}>
                    <Heart className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>Refer a friend</p>
                    <p className="text-xs" style={{ color: "var(--text-3)" }}>
                      {profile.role === "cook" ? "Invite a food lover — earn when they book" : "Invite a friend — earn rewards"}
                    </p>
                  </div>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shrink-0 transition-all active:scale-95"
                    style={{ background: "var(--accent)" }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.99]"
                style={{ background: "rgba(214,69,69,0.06)", border: "1px solid rgba(214,69,69,0.15)" }}
              >
                <span className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Sign out</span>
              </button>
            </div>
          )}

          {tab === "Specials" && isCook && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="f4l-section-label">Today's Specials</p>
                <button className="text-xs font-bold" style={{ color: "var(--accent)" }}>+ Add special</button>
              </div>
              {MOCK_SPECIALS.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="f4l-card p-4 flex items-center gap-3"
                >
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-1)" }}>{s.title}</p>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--text-3)" }}>{s.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>{formatNaira(s.price)}</span>
                      <span className={`f4l-badge ${s.available ? "f4l-badge-success" : "f4l-badge-muted"}`}>
                        {s.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>
                  <button>
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--text-3)" }} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {tab === "Reviews" && (
            <div className="space-y-3">
              {/* Rating summary */}
              <div className="f4l-card p-5 flex items-center gap-6 mb-4">
                <div className="text-center shrink-0">
                  <p className="font-heading text-4xl font-bold" style={{ color: "var(--text-1)" }}>{ratingDisplay}</p>
                  <div className="flex items-center gap-0.5 justify-center my-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5" style={{ fill: i < Math.round(profile.rating ?? 4.8) ? "#F59E0B" : "transparent", color: "#F59E0B" }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{profile.review_count ?? 0} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3].map((star) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs w-3" style={{ color: "var(--text-3)" }}>{star}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--divider)" }}>
                        <div className="h-full rounded-full" style={{ background: "#F59E0B", width: star === 5 ? "75%" : star === 4 ? "20%" : "5%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {MOCK_REVIEWS.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="f4l-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{r.avatar}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{r.reviewer}</p>
                        <p className="text-xs" style={{ color: "var(--text-3)" }}>{r.date}</p>
                      </div>
                      <div className="flex items-center gap-0.5 mb-1.5">
                        {[...Array(r.rating)].map((_, j) => (
                          <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>"{r.comment}"</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {tab === "Info" && (
            <div className="space-y-3">
              {[
                { label: "Member since", value: new Date(profile.created_at ?? "").toLocaleDateString("en-NG", { month:"long", year:"numeric" }) },
                { label: "Role", value: profile.role === "cook" ? "Home Chef" : "Food Lover" },
                { label: "Identity", value: isVerified ? "✓ Verified" : "Unverified" },
                { label: "KYC status", value: profile.kyc_status ?? "Not submitted" },
              ].map(({ label, value }) => (
                <div key={label} className="f4l-card p-4 flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--text-3)" }}>{label}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}