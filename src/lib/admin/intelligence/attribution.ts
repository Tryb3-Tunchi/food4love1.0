// Pure module with NO imports so it can be unit-tested with node --test.

export type Channel =
  | 'direct'
  | 'google'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'referral'
  | 'campaign'
  | 'other'

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: 'Direct',
  google: 'Google search',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X',
  referral: 'Referral link',
  campaign: 'Campaign link',
  other: 'Other websites',
}

export const SOCIAL_CHANNELS: Channel[] = [
  'instagram',
  'tiktok',
  'facebook',
  'x',
]

const SOURCE_ALIASES: Record<string, Channel> = {
  instagram: 'instagram',
  ig: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  x: 'x',
  twitter: 'x',
  google: 'google',
}

function channelFromHost(host: string): Channel | null {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram'
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
  if (h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.com') {
    return 'facebook'
  }
  if (h === 't.co' || h === 'x.com' || h === 'twitter.com') return 'x'
  if (/^google\.[a-z.]+$/.test(h) || h.endsWith('.google.com')) return 'google'
  return null
}

// Decide where a visit came from. UTM tags win (they are deliberate), then a
// referral code, then the referring website. Nothing here uses personal data.
export function classifyChannel(input: {
  utmSource?: string | null
  utmCampaign?: string | null
  referrerHost?: string | null
  hasReferralCode?: boolean
  ownHost?: string | null
}): Channel {
  const source = (input.utmSource ?? '').toLowerCase()
  if (source && SOURCE_ALIASES[source]) return SOURCE_ALIASES[source]
  if (input.hasReferralCode) return 'referral'
  if (source || input.utmCampaign) return 'campaign'

  const host = (input.referrerHost ?? '').toLowerCase().replace(/^www\./, '')
  if (!host) return 'direct'
  const own = (input.ownHost ?? '').toLowerCase().replace(/^www\./, '')
  if (own && host === own) return 'direct'
  return channelFromHost(host) ?? 'other'
}
