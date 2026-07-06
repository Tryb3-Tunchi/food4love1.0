export type Role = "cook" | "buyer";
export type MatchStatus = "pending" | "matched" | "expired" | "blocked";
export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type SwipeAction = "like" | "pass" | "superlike";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: Role;
  bio?: string;
  location?: string;
  cuisines?: string[];
  price_min?: number;
  price_max?: number;
  rating?: number;
  review_count?: number;
  is_verified?: boolean;
  kyc_status?: KycStatus;
  streak?: number;
  tour_completed?: boolean;
  onboarding_complete?: boolean;
  photos?: string[];
  daily_special?: DailySpecial;
  created_at: string;
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
  content: string;
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
  cook?: Profile;
  created_at: string;
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
