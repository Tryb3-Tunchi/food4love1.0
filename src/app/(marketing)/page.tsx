import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHow } from "@/components/landing/LandingHow";
import { LandingChefs } from "@/components/landing/LandingChefs";
import { LandingStats } from "@/components/landing/LandingStats";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-cream">
      <LandingNav />
      <LandingHero />
      <LandingHow />
      <LandingChefs />
      <LandingStats />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
