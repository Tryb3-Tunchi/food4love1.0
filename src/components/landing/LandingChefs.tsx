"use client";
import { motion } from "framer-motion";
import { Star, MapPin, BadgeCheck } from "lucide-react";
import Link from "next/link";

const CHEFS = [
  {
    name: "Adaeze Okonkwo",
    specialty: "Ofe Akwu & Bitterleaf Soup",
    cuisines: ["Igbo Cuisine", "Soups"],
    price: 8500,
    rating: 4.9,
    reviews: 47,
    location: "Lekki, Lagos",
    emoji: "👩🏿",
    verified: true,
    badge: "🏆 Top Chef",
  },
  {
    name: "Emeka Tochukwu",
    specialty: "Party Jollof & Small Chops",
    cuisines: ["Jollof", "Nigerian"],
    price: 12000,
    rating: 5.0,
    reviews: 63,
    location: "Victoria Island",
    emoji: "👨🏿",
    verified: true,
    badge: "⭐ Fan Favourite",
  },
  {
    name: "Fatima Balogun",
    specialty: "Tuwo Shinkafa & Miyan Kuka",
    cuisines: ["Hausa Cuisine"],
    price: 7000,
    rating: 4.9,
    reviews: 31,
    location: "Ikeja, Lagos",
    emoji: "👩🏾",
    verified: true,
    badge: null,
  },
  {
    name: "Blessing Nwosu",
    specialty: "Owo Soup & Fresh Starch",
    cuisines: ["Edo Cuisine"],
    price: 9500,
    rating: 4.8,
    reviews: 29,
    location: "Yaba, Lagos",
    emoji: "👩🏿",
    verified: true,
    badge: null,
  },
  {
    name: "Kunle Martins",
    specialty: "Amala & Ewedu — Premium",
    cuisines: ["Yoruba Fusion"],
    price: 11000,
    rating: 4.8,
    reviews: 55,
    location: "Surulere",
    emoji: "👨🏾",
    verified: false,
    badge: "🔥 Trending",
  },
  {
    name: "Grace Oduya",
    specialty: "Afang Soup & Pounded Yam",
    cuisines: ["Cross River"],
    price: 8000,
    rating: 4.9,
    reviews: 38,
    location: "Ajah, Lagos",
    emoji: "👩🏾",
    verified: true,
    badge: null,
  },
];

export function LandingChefs() {
  return (
    <section id="chefs" className="px-5 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end"
        >
          <div>
            <span className="mb-4 inline-block rounded-full border border-pepper/20 bg-pepper/10 px-4 py-1.5 text-sm font-bold text-pepper">
              Meet the chefs
            </span>
            <h2 className="text-balance text-display-lg text-ink">
              Real home cooks.
              <br />
              Real Nigerian food.
            </h2>
          </div>
          <Link
            href="/signup"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-pepper/30 px-5 py-2.5 text-sm font-bold text-pepper transition-all hover:bg-pepper hover:text-white"
          >
            See all chefs →
          </Link>
        </motion.div>

        {/* Chef cards grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CHEFS.map((chef, i) => (
            <motion.div
              key={chef.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group cursor-pointer overflow-hidden rounded-3xl border border-biscuit bg-white transition-all hover:border-pepper/20 hover:shadow-lift"
            >
              {/* Photo area — emoji on warm gradient */}
              <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-warmgray to-biscuit">
                <span className="text-7xl">{chef.emoji}</span>
                {chef.badge && (
                  <div className="absolute left-3 top-3 rounded-full border border-biscuit bg-white px-3 py-1 text-xs font-bold text-ink shadow-sm">
                    {chef.badge}
                  </div>
                )}
                {chef.verified && (
                  <div className="absolute right-3 top-3 rounded-full bg-lime p-1">
                    <BadgeCheck
                      className="h-3.5 w-3.5 text-white"
                      strokeWidth={3}
                    />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="mb-1 flex items-start justify-between">
                  <h3 className="text-base font-bold leading-tight text-ink">
                    {chef.name}
                  </h3>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-ember text-ember" />
                    <span className="text-sm font-bold text-ink">
                      {chef.rating}
                    </span>
                    <span className="text-xs text-muted">({chef.reviews})</span>
                  </div>
                </div>

                <p className="mb-3 text-sm leading-snug text-body">
                  {chef.specialty}
                </p>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {chef.cuisines.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-warmgray px-2.5 py-1 text-[11px] font-medium text-body"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-biscuit pt-3">
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3" />
                    {chef.location}
                  </div>
                  <span className="text-sm font-bold text-pepper">
                    ₦{(chef.price / 1000).toFixed(0)}k+
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-pepper px-8 py-4 font-bold text-white shadow-warm transition-all hover:bg-pepper/90 active:scale-95"
          >
            Match with a chef near you →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
