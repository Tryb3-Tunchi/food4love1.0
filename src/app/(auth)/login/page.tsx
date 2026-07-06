"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { ChefHat, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    const sb = createClient();
    // Show immediate feedback — don't make user wonder
    const loadingToast = toast.loading("Signing you in...");
    const { error } = await sb.auth.signInWithPassword(data);
    toast.dismiss(loadingToast);
    if (error) {
      toast.error("Incorrect email or password. Try again.");
      return;
    }
    toast.success("Welcome back! 🍽️");
    router.push("/swipe");
  };

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Left panel — branding (desktop only) */}
      <div className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-pepper p-10 lg:flex">
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-20%] top-[-20%] h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-10%] h-60 w-60 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-16 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Food4Love
            </span>
          </div>

          <h2 className="mb-4 text-4xl font-extrabold leading-tight text-white">
            Good food starts with a real cook.
          </h2>
          <p className="text-base leading-relaxed text-white/70">
            Sign in and keep discovering the home chefs who make Lagos, Abuja
            and Port Harcourt taste like home.
          </p>
        </div>

        {/* Floating food card */}
        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🍲</span>
            <div>
              <p className="text-sm font-bold text-white">Adaeze's Ofe Akwu</p>
              <p className="text-xs text-white/60">Lekki · ₦8,500 · ⭐ 4.9</p>
            </div>
          </div>
          <p className="mt-2 text-xs italic text-white/50">
            "Best bitterleaf soup I've had outside my grandmother's kitchen."
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
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

          <div className="mb-8">
            <h1 className="text-display-sm mb-2 text-ink">Welcome back</h1>
            <p className="text-sm text-body">
              No account yet?{" "}
              <Link
                href="/signup"
                className="font-semibold text-pepper hover:underline"
              >
                Sign up free
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
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
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t border-biscuit pt-6">
            <p className="text-subtle text-center text-xs">
              By signing in you agree to our{" "}
              <Link href="#" className="underline hover:text-ink">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="underline hover:text-ink">
                Privacy Policy
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
