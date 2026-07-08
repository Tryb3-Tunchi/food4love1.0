export type Role = "cook" | "buyer";
export type MatchStatus = "pending" | "matched" | "expired" | "blocked";
export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type SwipeAction = "like" | "pass" | "superlike";

export type LikeStatus = "pending" | "accepted" | "rejected";
export type SwipeDirection = SwipeAction;

export interface Profile {
  id: string;
  full_name?: string;
  // legacy/compat fields (optional)
  name?: string;
  nickname?: string;
  avatar_url?: string;
  role: Role;
  bio?: string;
  location?: string;
  cuisines?: string[];
  price_min?: number | null;
  price_max?: number | null;
  rating?: number;
  review_count?: number;
  is_verified?: boolean;
  kyc_status?: KycStatus;
  streak?: number;
  tour_completed?: boolean;
  onboarding_complete?: boolean;
  // legacy naming
  onboarding_completed?: boolean;
  photos?: string[];
  daily_special?: DailySpecial;
  created_at?: string;
  updated_at?: string;
  // additional legacy/demo fields
  looking_for?: string;
  age?: number;
  phone?: string | null;
  interests?: string[];
  favorite_foods?: string[];
  specialty?: string | null;
  is_bot?: boolean;
  bot_persona?: string | null;
  is_admin?: boolean;
  kyc_full_name?: string | null;
  kyc_country?: string | null;
  kyc_selfie?: string | null;
  kyc_id_doc?: string | null;
  lat?: number;
  lng?: number;
  available_for_parties?: boolean;
}

export interface DailySpecial {
  id: string;
  cook_id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  available_until: string;
  created_at: string;
}

export interface Swipe {
  id: string;
  swiper_id: string;
  swiped_id: string;
  action: SwipeAction;
  created_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  status: MatchStatus;
  expires_at: string;
  created_at: string;
  other_user?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content?: string;
  // legacy code uses `body`
  body?: string;
  read_at?: string;
  created_at: string;
}

export interface Story {
  id: string;
  cook_id: string;
  image_url: string;
  caption?: string;
  expires_at: string;
  viewed?: boolean;
  cook?: Profile | null;
  created_at: string;
}

export interface CookStory extends Story {
  cook?: Profile | null;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_swipe_date?: string | null;
  super_likes_available?: number | null;
  updated_at: string;
}

export interface Booking {
  id: string;
  match_id: string;
  cook_id: string;
  buyer_id: string;
  dish_title: string;
  price: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  scheduled_for?: string;
  created_at: string;
}
