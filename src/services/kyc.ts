import { createClient } from "@/lib/supabase/client";
const sb = () => createClient();

export interface KYCSubmission {
  id: string;
  user_id: string;
  full_name: string;
  id_type: "nin"|"bvn"|"passport"|"drivers_license";
  id_number: string;
  id_document_url: string;
  face_video_url: string;
  selfie_url?: string;
  status: "pending"|"approved"|"rejected";
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export async function submitKYC(data: Pick<KYCSubmission, "user_id"|"full_name"|"id_type"|"id_number"|"id_document_url"|"face_video_url"|"selfie_url">): Promise<KYCSubmission> {
  const { data: kyc, error } = await sb().from("kyc_submissions").insert({ ...data, status: "pending", submitted_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  await sb().from("profiles").update({ kyc_status: "pending" }).eq("id", data.user_id);
  return kyc;
}

export async function getKYCSubmissions(status?: string): Promise<KYCSubmission[]> {
  let q = sb().from("kyc_submissions").select("*, user:profiles(full_name, avatar_url, role)").order("submitted_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

export async function reviewKYC(id: string, userId: string, approved: boolean, rejectionReason?: string) {
  const status = approved ? "approved" : "rejected";
  await sb().from("kyc_submissions").update({ status, rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() }).eq("id", id);
  await sb().from("profiles").update({ kyc_status: approved ? "verified" : "rejected" }).eq("id", userId);
}
