import { createClient } from "@/lib/supabase/client";

export interface CreateBookingInput {
  match_id: string;
  cook_id: string;
  buyer_id: string;
  dish_title: string;
  price: number;
  scheduled_for: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
}

export async function createBooking(input: CreateBookingInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBookingsByUser(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      cook:profiles!bookings_cook_id_fkey(full_name, avatar_url),
      buyer:profiles!bookings_buyer_id_fkey(full_name, avatar_url)
    `)
    .or(`cook_id.eq.${userId},buyer_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}