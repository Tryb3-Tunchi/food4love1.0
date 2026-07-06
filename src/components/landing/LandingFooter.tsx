import Link from "next/link";
import { ChefHat } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-ink px-5 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col items-start justify-between gap-8 md:flex-row">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pepper">
                <ChefHat className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                Food<span className="text-pepper">4</span>Love
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-mist">
              Connecting home chefs with food lovers across Nigeria. Real food.
              Real people.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
            <Link
              href="/signup"
              className="text-mist transition-colors hover:text-white"
            >
              Sign up
            </Link>
            <Link
              href="/signup?role=cook"
              className="text-mist transition-colors hover:text-white"
            >
              Become a Chef
            </Link>
            <Link
              href="/login"
              className="text-mist transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/admin"
              className="text-mist transition-colors hover:text-white"
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-mist md:flex-row">
          <span>
            © {new Date().getFullYear()} Food4Love. Made with ❤️ in Nigeria.
          </span>
          <div className="flex gap-4">
            <Link href="#" className="transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link href="#" className="transition-colors hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
