import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "../types/db";

export type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signInWithOtp: (email: string) => Promise<void>;
  signUpWithPassword: (input: {
    email: string;
    password: string;
    phone: string | null;
    full_name: string;
    nickname: string | null;
  }) => Promise<{ requiresEmailConfirmation: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  resendSignupEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  upsertProfile: (input: {
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
  }) => Promise<Profile>;
  updateProfile: (
    patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>,
  ) => Promise<Profile>;
  refreshProfile: () => Promise<Profile | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
