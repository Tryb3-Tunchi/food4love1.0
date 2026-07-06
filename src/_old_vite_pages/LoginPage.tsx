import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from "../components/ui/Icons";
import { useTheme } from "../hooks/useTheme";

export function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    signInWithOtp,
    signInWithPassword,
    signUpWithPassword,
  } = useAuth();

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (user) {
      navigate(from === "/login" ? "/" : from, { replace: true });
    }
  }, [user, navigate, from]);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = fullName.trim();
    const e = email.trim();
    const p = password.trim();
    if (isSubmitting) return false;
    if (mode === "signup" && n.length < 2) return false;
    if (!e.includes("@")) return false;
    if (p.length < 8) return false;
    if (mode === "signup" && phone.trim().length < 7) return false;
    return true;
  }, [email, password, phone, fullName, isSubmitting, mode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedPhone = phone.trim();
      const trimmedFullName = fullName.trim();
      const trimmedNickname = nickname.trim();

      if (mode === "signup") {
        const result = await signUpWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
          phone: trimmedPhone ? trimmedPhone : null,
          full_name: trimmedFullName,
          nickname: trimmedNickname ? trimmedNickname : null,
        });
        if (result.requiresEmailConfirmation) {
          window.location.href = `/verify-email?email=${encodeURIComponent(
            trimmedEmail,
          )}`;
        } else {
          setStatus("Account created. You’re signed in.");
        }
      } else {
        await signInWithPassword(trimmedEmail, trimmedPassword);
        setStatus(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      const lower = message.toLowerCase();
      if (
        lower.includes("invalid") &&
        (lower.includes("redirect") || lower.includes("redirect url"))
      ) {
        setError(
          "Supabase redirect URL is not allowed. In Supabase Auth settings, add this site URL: " +
            window.location.origin,
        );
      } else if (lower.includes("error sending") && lower.includes("email")) {
        setError(
          "Supabase could not send the email. Configure an email provider (Auth → SMTP) or use the built-in dev email setup, then try again.",
        );
      } else if (lower.includes("captcha")) {
        setError(
          "Captcha is enabled in Supabase Auth. Disable it for now (Auth settings) or implement captcha on this page.",
        );
      } else if (
        lower.includes("signup") &&
        (lower.includes("disabled") || lower.includes("not allowed"))
      ) {
        setError(
          "Sign ups are disabled in Supabase. Enable Signups in Auth settings, then try again.",
        );
      } else if (lower.includes("rate limit")) {
        setError("Too many attempts. Wait a minute and try again.");
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-950 dark:text-zinc-50">
            Food4Love
            <span className="ml-2 rounded-full bg-brand-400/20 px-2 py-0.5 text-[11px] font-semibold text-slate-900 dark:bg-brand-500/20 dark:text-zinc-100">
              beta
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-zinc-50">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
            {mode === "signup"
              ? "A sweet way to match with cooks and plan your next craving."
              : "Sign in to keep swiping and chatting."}
          </p>
        </div>
        <Button variant="ghost" onClick={() => toggleTheme()}>
          {theme === "dark" ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </Button>
      </div>

      <Card className="border-black/10 bg-white/92 p-5 shadow-[0_26px_60px_-30px_rgba(2,6,23,0.25)] dark:border-white/12 dark:bg-slate-950/55 dark:shadow-[0_26px_60px_-34px_rgba(0,0,0,0.9)]">
        {user ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mb-4 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-brand-200 via-lime-100 to-punch-200 p-4 text-slate-950 shadow-[0_16px_28px_-18px_rgba(2,6,23,0.35)] dark:border-white/12 dark:from-brand-500/25 dark:via-lime-500/10 dark:to-punch-500/20 dark:text-zinc-50">
              <div className="text-xs font-semibold tracking-wide text-slate-700 dark:text-zinc-200">
                Today’s vibe
              </div>
              <div className="mt-1 text-base font-semibold">
                Sweet matches. Hot plates.
              </div>
              <div className="mt-1 text-sm text-slate-700/90 dark:text-zinc-200">
                Find cooks near you and fall in love with the menu.
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/12 dark:bg-white/8">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={[
                    "rounded-2xl px-3 py-3 text-sm font-semibold tracking-tight transition",
                    mode === "signup"
                      ? "bg-white text-slate-950 shadow-[0_10px_18px_-14px_rgba(2,6,23,0.35)] dark:bg-white/12 dark:text-zinc-50"
                      : "text-slate-700 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={[
                    "rounded-2xl px-3 py-3 text-sm font-semibold tracking-tight transition",
                    mode === "signin"
                      ? "bg-white text-slate-950 shadow-[0_10px_18px_-14px_rgba(2,6,23,0.35)] dark:bg-white/12 dark:text-zinc-50"
                      : "text-slate-700 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  Sign in
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" ? (
                <>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                      Full name
                    </div>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-slate-950 outline-none ring-brand-400/40 transition focus:border-brand-400/40 focus:ring-2 hover:border-black/20 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                      Nickname (optional)
                    </div>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="What should we call you?"
                      className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-slate-950 outline-none ring-brand-400/40 transition focus:border-brand-400/40 focus:ring-2 hover:border-black/20 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20"
                    />
                  </label>
                </>
              ) : null}

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Email
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-slate-950 outline-none ring-brand-400/40 transition focus:border-brand-400/40 focus:ring-2 hover:border-black/20 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20"
                />
              </label>

              {mode === "signup" ? (
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Phone number
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-slate-950 outline-none ring-brand-400/40 transition focus:border-brand-400/40 focus:ring-2 hover:border-black/20 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20"
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="mb-1 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Password
                </div>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 pr-11 text-sm text-slate-950 outline-none ring-brand-400/40 transition focus:border-brand-400/40 focus:ring-2 hover:border-black/20 dark:border-white/12 dark:bg-white/8 dark:text-zinc-100 dark:hover:border-white/20"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>

              <Button
                disabled={!canSubmit}
                type="submit"
                variant="primary"
                className="w-full"
              >
                {isSubmitting
                  ? mode === "signup"
                    ? "Creating…"
                    : "Signing in…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </Button>

              {mode === "signin" ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setError(null);
                    setStatus(null);
                    setIsSubmitting(true);
                    try {
                      const trimmedEmail = email.trim();
                      if (!trimmedEmail.includes("@")) {
                        throw new Error("Enter your email first.");
                      }
                      await signInWithOtp(trimmedEmail);
                      setStatus("Check your email for a sign-in link.");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Send me a sign-in link
                </Button>
              ) : null}

              {status ? (
                <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-sm text-slate-700 dark:border-white/15 dark:bg-white/6 dark:text-zinc-200">
                  {status}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
