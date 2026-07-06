import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getSiteUrl, supabase } from "../lib/supabase";
import type { Profile, UserRole } from "../types/db";
import { AuthContext } from "./AuthContext";

const generateReferralCode = (userId: string): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(h);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[(abs + i * 37) % chars.length];
  }
  return code;
};

const normalizeProfileTableNotFound = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("not found") ||
    lower.includes("relation") ||
    lower.includes("does not exist")
  ) {
    return new Error(
      "Supabase table 'profiles' was not found. Run supabase/schema.sql in the Supabase SQL editor, then refresh.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authUser = userData.user ?? user ?? null;
    const userId = authUser?.id ?? null;
    if (!userId) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw normalizeProfileTableNotFound(error);
    const existing = (data as Profile | null) ?? null;
    if (existing) {
      setProfile(existing);
      return existing;
    }

    const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const nickname =
      typeof meta.nickname === "string" ? meta.nickname.trim() : "";
    const phone = typeof meta.phone === "string" ? meta.phone.trim() : "";

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        role: "buyer" satisfies UserRole,
        name: fullName || authUser?.email?.split("@")[0] || "User",
        nickname: nickname || null,
        looking_for: null,
        age: null,
        avatar_url: null,
        phone: phone || null,
        bio: null,
        cuisines: null,
        interests: null,
        favorite_foods: null,
        photos: null,
        specialty: null,
        price_min: null,
        price_max: null,
        is_bot: false,
        bot_persona: null,
        is_admin: false,
        onboarding_completed: false,
        kyc_status: "unverified",
        kyc_full_name: null,
        kyc_country: null,
        kyc_selfie: null,
        kyc_id_doc: null,
        lat: null,
        lng: null,
        available_for_parties: false,
        last_seen_at: new Date().toISOString(),
        referral_code: generateReferralCode(userId),
      })
      .select("*")
      .single();
    if (createError) throw normalizeProfileTableNotFound(createError);
    setProfile(created as Profile);
    return created as Profile;
  }, [user]);

  useEffect(() => {
    let isActive = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsAuthLoading(false);
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      },
    );

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }
    setIsProfileLoading(true);
    refreshProfile()
      .catch(() => {})
      .finally(() => setIsProfileLoading(false));
  }, [refreshProfile, user]);

  useEffect(() => {
    if (!user?.id || !profile || profile.is_bot) return;
    const key = "lovefoodmatch.lastSeenSent";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    sessionStorage.setItem(key, String(Date.now()));
    void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  }, [user?.id, profile?.id]);

  useEffect(() => {
    if (!user?.id || !profile) return;
    if (profile.is_bot) return;
    if (profile.lat != null && profile.lng != null) return;

    const key = "lovefoodmatch.locationPromptedAt";
    const raw = localStorage.getItem(key);
    const last = raw ? Number(raw) : 0;
    const now = Date.now();
    if (
      Number.isFinite(last) &&
      last > 0 &&
      now - last < 7 * 24 * 60 * 60 * 1000
    )
      return;

    if (!navigator.geolocation) return;
    localStorage.setItem(key, String(now));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .update({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            })
            .eq("id", user.id)
            .select("*")
            .single();
          if (error) return;
          setProfile(data as Profile);
        } catch {
          return;
        }
      },
      () => {
        return;
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [profile, user?.id]);

  const value = {
    isLoading: isAuthLoading || isProfileLoading,
    session,
    user,
    profile,
    signInWithOtp: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getSiteUrl() },
      });
      if (error) throw error;
    },
    signUpWithPassword: async (input: {
      email: string;
      password: string;
      phone: string | null;
      full_name: string;
      nickname: string | null;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            phone: input.phone,
            full_name: input.full_name,
            nickname: input.nickname,
            name: input.full_name,
            display_name: input.full_name,
          },
          emailRedirectTo: getSiteUrl(),
        },
      });
      if (error) throw error;
      return { requiresEmailConfirmation: !data.session };
    },
    resendSignupEmail: async (email: string) => {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getSiteUrl() },
      });
      if (error) throw error;
    },
    signInWithPassword: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    upsertProfile: async (input: {
      role: UserRole;
      name: string;
      avatar_url: string | null;
      phone: string | null;
      nickname?: string | null;
      looking_for?: string | null;
      bio: string | null;
      cuisines: string[] | null;
      interests: string[] | null;
      favorite_foods: string[] | null;
      age?: number | null;
      specialty?: string | null;
      price_min?: number | null;
      price_max?: number | null;
      lat: number | null;
      lng: number | null;
    }) => {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          role: input.role,
          name: input.name,
          nickname: input.nickname ?? null,
          looking_for: input.looking_for ?? null,
          avatar_url: input.avatar_url,
          phone: input.phone,
          bio: input.bio,
          cuisines: input.cuisines,
          interests: input.interests,
          favorite_foods: input.favorite_foods,
          age: input.age ?? null,
          specialty: input.specialty ?? null,
          price_min: input.price_min ?? null,
          price_max: input.price_max ?? null,
          lat: input.lat,
          lng: input.lng,
        })
        .select("*")
        .single();

      if (error) throw normalizeProfileTableNotFound(error);
      setProfile(data as Profile);
      return data as Profile;
    },
    updateProfile: async (
      patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>,
    ) => {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single();

      if (error) throw normalizeProfileTableNotFound(error);
      setProfile(data as Profile);
      return data as Profile;
    },
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
