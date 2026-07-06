import { createClient } from "@/lib/supabase/client";
import { Booking } from "@/types/db";
const sb = () => createClient();

export async function createBooking(data: Omit<Booking, "id"|"created_at"|"status">): Promise<Booking> {
  const { data: booking, error } = await sb().from("bookings").insert({ ...data, status: "pending" }).select().single();
  if (error) throw error;
  return booking;
}

export async function getBookings(userId: string): Promise<Booking[]> {
  const { data } = await sb().from("bookings").select("*").or(`cook_id.eq.${userId},buyer_id.eq.${userId}`).order("created_at", { ascending: false });
  return data ?? [];
}

export async function updateBookingStatus(id: string, status: Booking["status"]) {
  const { data, error } = await sb().from("bookings").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
