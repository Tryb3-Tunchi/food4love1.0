"use client";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-char px-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-pepper/10 border border-pepper/20">
          <Mail className="h-10 w-10 text-pepper" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Check your email</h1>
        <p className="text-mist mb-8">We sent a verification link to your email. Click it to activate your account.</p>
        <Button asChild variant="ember" size="lg" className="w-full"><Link href="/login">Back to Sign In</Link></Button>
      </motion.div>
    </div>
  );
}
