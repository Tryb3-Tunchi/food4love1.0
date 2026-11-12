import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { welcomeEmail } from '@/lib/email/templates'
import { isFreshConfirmation } from '@/lib/email/freshness'
import { sendTransactionalEmail } from '@/lib/email/transactional'

// The welcome email goes out when the visitor has just confirmed their email
// address (the auth callback, after the code exchange succeeds). Before that
// moment the account is not confirmed, so a "welcome, you're in" message would
// be untrue, and Supabase's own confirmation email is left completely alone.
export async function sendWelcomeEmailAfterVerification(
  user: User | null,
  appUrl: string,
): Promise<void> {
  try {
    // Off switch for the team: set WELCOME_EMAIL_ENABLED=false in the server
    // environment to stop this email without a code change (for example if the
    // Supabase confirmation email is meant to act as the welcome).
    if (process.env.WELCOME_EMAIL_ENABLED === 'false') return
    if (!user?.email || !isFreshConfirmation(user.email_confirmed_at)) return

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    // One welcome per account, ever: the tracking row is keyed on the user id
    // and Resend also holds an idempotency key, so retries cannot double-send.
    await sendTransactionalEmail({
      admin,
      kind: 'welcome',
      recipientKey: user.id,
      to: user.email,
      email: welcomeEmail({
        name: profile?.full_name ?? null,
        role: profile?.role ?? null,
        appUrl,
      }),
    })
  } catch {
    // Registration must never depend on the email provider.
  }
}
