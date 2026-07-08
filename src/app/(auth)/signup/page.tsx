"use client";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, SignupInput } from "@/lib/validations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  ChefHat,
  Phone,
  User,
  Mail,
  Lock,
  ArrowRight,
  Check,
} from "lucide-react";

const PERKS = [
  "Match with verified home chefs",
  "Real-time chat and booking",
  "AI-powered meal suggestions",
  "Secure payments and dispute protection",
];

function SignupPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const role = params.get("role") === "cook" ? "cook" : "buyer";
  const isCook = role === "cook";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupInput) => {
    const sb = createClient();
    const loadingToast = toast.loading("Creating your account...");
    const { error } = await sb.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.full_name, phone: data.phone, role } },
    });
    toast.dismiss(loadingToast);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Check your email ✉️");
    router.push("/verify");
  };

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Left panel */}
      <div className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-ink p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-20%] top-[-10%] h-72 w-72 rounded-full bg-pepper/15 blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-10%] h-60 w-60 rounded-full bg-ember/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="mb-16 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pepper">
              <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Food4Love
            </span>
          </Link>

          <h2 className="mb-4 text-4xl font-extrabold leading-tight text-white">
            {isCook
              ? "Turn your kitchen into a business."
              : "Meet the chef who'll change how you eat."}
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-white/50">
            {isCook
              ? "Set your own prices, schedule, and menu. We handle the discovery, you handle the magic."
              : "Home-cooked meals made by talented people in your city. No restaurants. Just real food."}
          </p>

          <div className="space-y-3">
            {PERKS.map((p) => (
              <div key={p} className="flex items-center gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pepper/20">
                  <Check className="h-3 w-3 text-pepper" strokeWidth={3} />
                </div>
                <span className="text-sm text-white/70">{p}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/30">
          Free to join · No credit card required
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pepper">
              <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-ink">
              Food<span className="text-pepper">4</span>Love
            </span>
          </Link>

          {/* Role pill */}
          <div className="bg-pepper/8 mb-6 inline-flex items-center gap-2 rounded-full border border-pepper/15 px-3 py-1.5">
            <span className="text-lg">{isCook ? "🍳" : "🍽️"}</span>
            <span className="text-xs font-bold text-pepper">
              {isCook ? "Signing up as a Chef" : "Signing up as a Food Lover"}
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-display-sm mb-2 text-ink">
              Create your account
            </h1>
            <p className="text-sm text-body">
              Already have one?{" "}
              <Link
                href="/login"
                className="font-semibold text-pepper hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <Input
              label="Full name"
              placeholder="Adaeze Okonkwo"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Phone number"
              placeholder="+234 801 234 5678"
              leftIcon={<Phone className="h-4 w-4" />}
              error={errors.phone?.message}
              hint="Nigerian number · used for match notifications"
              {...register("phone")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              hint="Minimum 6 characters"
              {...register("password")}
            />

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isSubmitting}
              rightIcon={
                !isSubmitting ? <ArrowRight className="h-4 w-4" /> : undefined
              }
              className="mt-2"
            >
              Create Account
            </Button>
          </form>

          {/* Role switch */}
          <div className="mt-5 text-center">
            <p className="text-subtle mb-2 text-xs">
              {isCook ? "Want to find food instead?" : "Want to cook and earn?"}
            </p>
            <Link
              href={isCook ? "/signup" : "/signup?role=cook"}
              className="text-xs font-semibold text-pepper hover:underline"
            >
              {isCook ? "Sign up as a Food Lover" : "Sign up as a Chef"} →
            </Link>
          </div>

          <p className="text-subtle mt-6 text-center text-xs">
            By creating an account you agree to our{" "}
            <Link href="#" className="underline hover:text-ink">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="underline hover:text-ink">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="text-sm font-medium text-body">Loading...</div>
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
