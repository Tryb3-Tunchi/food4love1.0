import { createClient as createBrowserClient } from "./supabase/client";

// Export a browser supabase client for hooks and components that expect a `supabase` instance.
// This keeps the import path `../lib/supabase` working across the codebase.
export const supabase: any = createBrowserClient();

export const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
