import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LikeStatus, Profile, SwipeDirection } from "../types/db";

const demoCooks: Profile[] = [
  {
    id: "demo-1",
    role: "cook",
    name: "Chioma",
    nickname: "Chioma",
    looking_for: "Food dates and loyal customers",
    age: 26,
    avatar_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "If you love smoky jollof, soft plantain, and proper stew… you're in the right place.",
    cuisines: ["Nigerian"],
    interests: ["Home cooking", "Spicy", "Street food"],
    favorite_foods: ["Jollof Rice", "Fried Plantain", "Chicken"],
    photos: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1604908176997-125f25cc500c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Jollof Rice",
    price_min: 2500,
    price_max: 7000,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.4541,
    lng: 3.3947,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-2",
    role: "cook",
    name: "Tunde",
    nickname: "Tunde",
    looking_for: "Late-night suya and good vibes",
    age: 29,
    avatar_url:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "Proper suya, hot yaji, and cold drinks. Come chop.",
    cuisines: ["Nigerian"],
    interests: ["Street food", "BBQ", "Spicy"],
    favorite_foods: ["Suya", "Peppered Snail", "Asun"],
    photos: [
      "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Suya",
    price_min: 2000,
    price_max: 6000,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.46,
    lng: 3.41,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-3",
    role: "cook",
    name: "Amina",
    nickname: "Amina",
    looking_for: "Soft life + good soup",
    age: 25,
    avatar_url:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "Egusi that hits, pounded yam that stretches, and stew that behaves.",
    cuisines: ["Nigerian"],
    interests: ["Home cooking", "Healthy", "Fine dining"],
    favorite_foods: ["Egusi Soup", "Pounded Yam", "Semo"],
    photos: [
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Egusi Soup",
    price_min: 3500,
    price_max: 9000,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.455,
    lng: 3.385,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-4",
    role: "cook",
    name: "Sade",
    nickname: "Sade",
    looking_for: "Date night with proper swallow",
    age: 30,
    avatar_url:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "Efo riro with assorted meat. If you're serious, you'll lick the plate.",
    cuisines: ["Nigerian"],
    interests: ["Home cooking", "Fine dining", "Spicy"],
    favorite_foods: ["Efo Riro", "Pounded Yam", "Assorted meat"],
    photos: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Efo Riro",
    price_min: 5000,
    price_max: 15000,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.448,
    lng: 3.401,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-5",
    role: "cook",
    name: "Bola",
    nickname: "Bola",
    looking_for: "Brunch and small chops",
    age: 27,
    avatar_url:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "Soft moi moi, akara that's not oily, and pap that's smooth.",
    cuisines: ["Nigerian"],
    interests: ["Brunch", "Healthy", "Home cooking"],
    favorite_foods: ["Moi Moi", "Akara", "Pap"],
    photos: [
      "https://images.unsplash.com/photo-1496440737103-cd596325d314?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Moi Moi",
    price_min: 2000,
    price_max: 5000,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.461,
    lng: 3.39,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-6",
    role: "cook",
    name: "Adaeze",
    nickname: "Ada",
    looking_for: "Regulars who love pepper soup",
    age: 28,
    avatar_url:
      "https://images.unsplash.com/photo-1551069613-1904dbdcda11?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "Catfish pepper soup to cure anything — heartbreak, cold, or just hunger.",
    cuisines: ["Nigerian"],
    interests: ["Comfort food", "Spicy", "Late night"],
    favorite_foods: ["Catfish Pepper Soup", "Goat Pepper Soup"],
    photos: [
      "https://images.unsplash.com/photo-1546961342-ea5f62d5a27b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: "Catfish Pepper Soup",
    price_min: 3000,
    price_max: 8500,
    is_bot: false,
    bot_persona: null,
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "verified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.44,
    lng: 3.42,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-7",
    role: "buyer",
    name: "Ngozi",
    nickname: "Ngozi",
    looking_for: "Food dates",
    age: 25,
    avatar_url:
      "https://images.unsplash.com/photo-1542596768-5d1d21f1cf98?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "I'm here for good vibes and better food. If you make jollof, I'm listening.",
    cuisines: ["Nigerian"],
    interests: ["Brunch", "Coffee", "Desserts"],
    favorite_foods: ["Jollof Rice", "Suya"],
    photos: [
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: null,
    price_min: null,
    price_max: null,
    is_bot: true,
    bot_persona:
      "Nigerian buyer bot. Warm and playful, keeps replies short, asks one question back, suggests meeting for food.",
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "unverified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.452,
    lng: 3.395,
    created_at: "",
    updated_at: "",
  },
  {
    id: "demo-8",
    role: "buyer",
    name: "Chinedu",
    nickname: "Chinedu",
    looking_for: "Food buddies",
    age: 29,
    avatar_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
    phone: null,
    bio: "If the stew no pepper, we fit add am.",
    cuisines: ["Nigerian"],
    interests: ["Street food", "Spicy", "BBQ"],
    favorite_foods: ["Pepper Soup", "Suya"],
    photos: [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
    ],
    specialty: null,
    price_min: null,
    price_max: null,
    is_bot: true,
    bot_persona:
      "Nigerian buyer bot. Confident, funny, flirty. Loves spicy food talk. Suggests a simple plan fast.",
    is_admin: false,
    onboarding_completed: true,
    kyc_status: "unverified",
    kyc_full_name: null,
    kyc_country: null,
    kyc_selfie: null,
    kyc_id_doc: null,
    lat: 6.458,
    lng: 3.41,
    created_at: "",
    updated_at: "",
  },
];

type SwipeState = {
  isLoading: boolean;
  cooks: Profile[];
  activeCook: Profile | null;
  like: () => Promise<void>;
  skip: () => void;
  refresh: () => Promise<void>;
  isExhausted: boolean;
};

type SwipeInput = {
  buyerId: string | null;
  buyerProfile: Profile | null;
  maxDistanceKm?: number;
  filterRole?: "all" | "cook" | "buyer";
  minAge?: number | null;
  maxAge?: number | null;
  maxPrice?: number | null;
  availableForParties?: boolean;
};

const toSet = (arr: string[] | null | undefined) =>
  new Set((arr ?? []).map((s) => s.trim()).filter(Boolean));

const intersectionCount = (
  a: string[] | null | undefined,
  b: string[] | null | undefined,
) => {
  const sa = toSet(a);
  if (sa.size === 0) return 0;
  let count = 0;
  for (const item of b ?? []) {
    if (sa.has(item.trim())) count += 1;
  }
  return count;
};

const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

const jitter01 = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
};

const getOrCreateSessionSeed = (): number => {
  try {
    const key = "lovefoodmatch.sessionSeed";
    const existing = sessionStorage.getItem(key);
    if (existing) return parseFloat(existing);
    const seed = Math.random();
    sessionStorage.setItem(key, String(seed));
    return seed;
  } catch {
    return Math.random();
  }
};

const SESSION_SEED = getOrCreateSessionSeed();
const SWIPE_INDEX_KEY = "lovefoodmatch.swipeIndex";

export function useSwipe(input: SwipeInput): SwipeState {
  const buyerId = input.buyerId;
  const buyerProfile = input.buyerProfile;
  const maxDistanceKm = input.maxDistanceKm ?? 35;
  const filterRole = input.filterRole ?? "cook";
  const minAge = input.minAge ?? null;
  const maxAge = input.maxAge ?? null;
  const maxPrice = input.maxPrice ?? null;
  const availableForParties = input.availableForParties ?? false;
  const [isLoading, setIsLoading] = useState(true);
  const [cooks, setCooks] = useState<Profile[]>([]);
  const [activeIndex, setActiveIndex] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SWIPE_INDEX_KEY);
      return saved ? Math.max(0, parseInt(saved, 10)) : 0;
    } catch {
      return 0;
    }
  });

  const isFirstMount = useRef(true);

  const activeCook = cooks[activeIndex] ?? null;
  const isExhausted = !isLoading && activeIndex >= cooks.length;

  useEffect(() => {
    try {
      sessionStorage.setItem(SWIPE_INDEX_KEY, String(activeIndex));
    } catch {}
  }, [activeIndex]);

  const refresh = useCallback(async () => {
    if (!buyerId) {
      setCooks([]);
      setActiveIndex(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: swipesData, error: swipesError } = await supabase
        .from("swipes")
        .select("target_id")
        .eq("swiper_id", buyerId);

      if (swipesError) throw swipesError;

      const excludedIds = (swipesData ?? [])
        .map((row) => row.target_id)
        .filter(Boolean);

      let cooksQuery = supabase.from("profiles").select("*").neq("id", buyerId);

      if (filterRole !== "all") {
        cooksQuery = cooksQuery.eq("role", filterRole);
      }

      if (excludedIds.length > 0) {
        cooksQuery = cooksQuery.not(
          "id",
          "in",
          `(${excludedIds.map((id) => `"${id}"`).join(",")})`,
        );
      }

      const { data: cooksData, error: cooksError } = await cooksQuery.limit(80);
      if (cooksError) throw cooksError;

      const rawCooks =
        ((cooksData as Profile[]) ?? []).length > 0
          ? ((cooksData as Profile[]) ?? [])
          : demoCooks;

      const buyerLoc =
        buyerProfile?.lat != null && buyerProfile?.lng != null
          ? { lat: buyerProfile.lat, lng: buyerProfile.lng }
          : null;

      const scored = rawCooks.map((cook) => {
        const distKm =
          buyerLoc && cook.lat != null && cook.lng != null
            ? haversineKm(buyerLoc, { lat: cook.lat, lng: cook.lng })
            : null;
        const cuisineMatches = intersectionCount(
          buyerProfile?.cuisines,
          cook.cuisines,
        );
        const interestMatches = intersectionCount(
          buyerProfile?.interests,
          cook.interests,
        );
        const favoriteMatches = intersectionCount(
          buyerProfile?.favorite_foods,
          cook.favorite_foods,
        );

        const tasteScore =
          cuisineMatches * 14 + interestMatches * 10 + favoriteMatches * 6;
        const distancePenalty =
          distKm != null ? Math.min(distKm, 90) * 0.35 : 0;
        const randomness = (jitter01(cook.id + String(SESSION_SEED)) - 0.5) * 3;
        const score = tasteScore - distancePenalty + randomness;

        return { cook, score, distKm };
      });

      let filtered =
        buyerLoc != null
          ? scored.filter((x) => x.distKm == null || x.distKm <= maxDistanceKm)
          : scored;

      if (minAge != null) {
        filtered = filtered.filter(
          (x) => x.cook.age == null || x.cook.age >= minAge,
        );
      }
      if (maxAge != null) {
        filtered = filtered.filter(
          (x) => x.cook.age == null || x.cook.age <= maxAge,
        );
      }
      if (maxPrice != null) {
        filtered = filtered.filter(
          (x) => x.cook.price_min == null || x.cook.price_min <= maxPrice,
        );
      }
      if (availableForParties) {
        filtered = filtered.filter((x) => x.cook.available_for_parties === true);
      }

      const sortedFiltered = (filtered.length > 0 ? filtered : scored)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.cook);

      let finalList: Profile[];
      if (filterRole === "all" && buyerProfile?.role === "buyer") {
        const cookPool = sortedFiltered.filter((p) => p.role === "cook");
        const buyerPool = sortedFiltered.filter((p) => p.role === "buyer");
        const mixed: Profile[] = [];
        let ci = 0;
        let bi = 0;
        while (mixed.length < sortedFiltered.length && (ci < cookPool.length || bi < buyerPool.length)) {
          for (let c = 0; c < 4 && ci < cookPool.length; c += 1) {
            mixed.push(cookPool[ci]);
            ci += 1;
          }
          if (bi < buyerPool.length) {
            mixed.push(buyerPool[bi]);
            bi += 1;
          }
        }
        finalList = mixed;
      } else {
        finalList = sortedFiltered;
      }

      setCooks(finalList);
      if (!isFirstMount.current) setActiveIndex(0);
      isFirstMount.current = false;
      setIsLoading(false);
    } catch {
      setCooks(demoCooks);
      if (!isFirstMount.current) setActiveIndex(0);
      isFirstMount.current = false;
      setIsLoading(false);
    }
  }, [
    buyerId,
    buyerProfile?.cuisines,
    buyerProfile?.favorite_foods,
    buyerProfile?.interests,
    buyerProfile?.lat,
    buyerProfile?.lng,
    buyerProfile?.role,
    maxDistanceKm,
    filterRole,
    minAge,
    maxAge,
    maxPrice,
    availableForParties,
  ]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const upsertSwipe = useCallback(
    async (direction: SwipeDirection) => {
      if (!buyerId) throw new Error("Not authenticated");
      if (!activeCook) return;

      if (activeCook.id.startsWith("demo-")) {
        const key =
          direction === "like"
            ? "lovefoodmatch.demoLikes"
            : "lovefoodmatch.demoPasses";
        const raw = localStorage.getItem(key);
        let prev: unknown = [];
        try {
          prev = raw ? (JSON.parse(raw) as unknown) : [];
        } catch {
          prev = [];
        }
        const next = Array.isArray(prev)
          ? Array.from(new Set([...prev, activeCook.id]))
          : [activeCook.id];
        localStorage.setItem(key, JSON.stringify(next));
        setActiveIndex((i) => i + 1);
        return;
      }

      const { error } = await supabase.from("swipes").upsert({
        swiper_id: buyerId,
        target_id: activeCook.id,
        direction,
      });
      if (error) throw error;

      if (direction === "like") {
        if (activeCook.role === "cook") {
          const { error: likeError } = await supabase.from("likes").upsert({
            buyer_id: buyerId,
            cook_id: activeCook.id,
            status: "pending" satisfies LikeStatus,
          });
          if (likeError) throw likeError;
        } else {
          const { data: reverse, error: reverseError } = await supabase
            .from("swipes")
            .select("id")
            .eq("swiper_id", activeCook.id)
            .eq("target_id", buyerId)
            .eq("direction", "like")
            .maybeSingle();
          if (reverseError) throw reverseError;
          if (reverse) {
            const a = buyerId;
            const b = activeCook.id;
            const buyer_id = a < b ? a : b;
            const cook_id = a < b ? b : a;
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const { error: matchError } = await supabase
              .from("matches")
              .upsert({
                buyer_id,
                cook_id,
                expires_at,
              });
            if (matchError) throw matchError;
          }
        }
      }

      setActiveIndex((i) => i + 1);
    },
    [activeCook, buyerId],
  );

  const skip = useCallback(() => upsertSwipe("pass"), [upsertSwipe]);

  const like = useCallback(() => upsertSwipe("like"), [upsertSwipe]);

  return useMemo(
    () => ({
      isLoading,
      cooks,
      activeCook,
      like,
      skip,
      refresh,
      isExhausted,
    }),
    [isLoading, cooks, activeCook, like, skip, refresh, isExhausted],
  );
}
