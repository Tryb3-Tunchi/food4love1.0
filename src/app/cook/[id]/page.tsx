import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatNaira } from "@/lib/utils";
import { Star, MapPin, Shield, ChefHat } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("full_name, bio, cuisines, avatar_url").eq("id", params.id).single();
  if (!data) return { title: "Chef not found" };
  return {
    title: `${data.full_name} — Home Chef on Food4Love`,
    description: data.bio ?? `${data.full_name} cooks ${data.cuisines?.join(", ")} on Food4Love`,
    openGraph: { images: data.avatar_url ? [data.avatar_url] : [] },
  };
}

export default async function CookPublicPage({ params }: { params: { id: string } }) {
  const sb = await createClient();
  const { data: chef } = await sb.from("profiles").select("*, daily_special:daily_specials(*)").eq("id", params.id).eq("role", "cook").single();
  if (!chef) notFound();

  return (
    <div className="min-h-screen bg-char">
      {/* Hero */}
      <div className="relative h-64 bg-gradient-to-br from-ember/30 to-pepper/30">
        {chef.photos?.[0] && <Image src={chef.photos[0]} alt={chef.full_name} fill className="object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-char to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4">
          <Avatar src={chef.avatar_url} name={chef.full_name} size="2xl" verified={chef.is_verified} className="border-4 border-char" />
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-white">{chef.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {chef.is_verified && <Badge variant="success" size="sm"><Shield className="h-3 w-3" />Verified Chef</Badge>}
              {chef.rating && <Badge variant="ember" size="sm"><Star className="h-3 w-3 fill-ember" />{chef.rating.toFixed(1)}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6 space-y-5">
        {chef.location && <div className="flex items-center gap-1.5 text-ash text-sm"><MapPin className="h-4 w-4" />{chef.location}</div>}
        {chef.bio && <p className="text-ash leading-relaxed text-sm">{chef.bio}</p>}
        {chef.cuisines?.length && (
          <div className="flex flex-wrap gap-2">
            {chef.cuisines.map((c: string) => <Badge key={c} variant="muted">{c}</Badge>)}
          </div>
        )}
        {chef.price_min && (
          <div className="rounded-xl bg-smoke border border-white/5 p-4 flex items-center justify-between">
            <div><p className="text-xs text-mist mb-0.5">Starting from</p><p className="text-xl font-bold text-ember">{formatNaira(chef.price_min)}</p></div>
            <ChefHat className="h-8 w-8 text-ash" />
          </div>
        )}
        <Button asChild variant="ember" size="lg" className="w-full">
          <Link href={`/signup?ref_chef=${params.id}`}>Match with {chef.full_name.split(" ")[0]} →</Link>
        </Button>
        <p className="text-center text-xs text-mist">Join Food4Love to connect with {chef.full_name.split(" ")[0]}</p>
      </div>
    </div>
  );
}
