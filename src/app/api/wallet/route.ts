import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const [
      { data: profile, error: profileError },
      { data: account, error: accountError },
      { data: referrals, error: referralsError },
      { data: transactions, error: transactionsError },
      { data: pendingTopups, error: topupsError },
    ] = await Promise.all([
      admin
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('wallet_accounts')
        .select('balance_naira')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('referrals')
        .select('id, second_rewarded_at')
        .eq('referrer_id', user.id),
      admin
        .from('wallet_transactions')
        .select('id, amount_naira, transaction_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('wallet_topups')
        .select('amount_naira, paystack_reference, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (
      profileError ||
      accountError ||
      referralsError ||
      transactionsError ||
      topupsError
    ) {
      return NextResponse.json(
        { error: 'Could not load wallet information' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      referral_code: profile?.referral_code ?? null,
      balance_naira: account?.balance_naira ?? 0,
      referral_count: referrals?.length ?? 0,
      completed_referrals:
        referrals?.filter((referral) => referral.second_rewarded_at).length ??
        0,
      transactions: transactions ?? [],
      pending_topups: pendingTopups ?? [],
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load wallet information' },
      { status: 500 },
    )
  }
}
