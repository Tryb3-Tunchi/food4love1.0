// Web Push VAPID PUBLIC keys, one per Supabase project. Pure (no imports): unit-tested.
//
// These are PUBLIC by design: every browser receives the key when it subscribes. The matching
// private keys and dispatch secrets live only in Supabase Edge Function secrets and an owner-only
// folder outside this repository; they must never be added here.
//
// The key is chosen from the Supabase project the build is already bound to
// (NEXT_PUBLIC_SUPABASE_URL), so production and staging can never use each other's key, and no
// separate Vercel setting is needed. Fails closed: an unknown project gets NO key, so push stays
// off instead of subscribing devices with a key the server cannot sign for.
export const PUSH_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze(
  {
    // production: Food4Love
    oynhaqpuqzvaymntnzqo:
      'BGDFub0wRqa5HM01FrpbpiD005GATbDcGOrrKocaoK2CAb-r3ArqxCHdUiXIKjxg5NH69J56dRW9sMVr0v3dXlY',
    // staging: food4love-staging
    pnqjzlzcvrtkpzhonjft:
      'BA1Zsl7hH1cLrGQMUdoWzTa7K8ffi8YDSgdkUSXRG5sVj1YMhXrwnDZ8jGeuVSbM-YMZWxXDIZ69v3n1wVpvBc4',
  },
)

// "https://<ref>.supabase.co" (optionally with a trailing slash) -> "<ref>"; anything else -> null.
export function supabaseProjectRef(
  url: string | undefined | null,
): string | null {
  if (typeof url !== 'string') return null
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url.trim())
  return match ? match[1] : null
}

export function pushPublicKeyFor(
  supabaseUrl: string | undefined | null,
): string | null {
  const ref = supabaseProjectRef(supabaseUrl)
  return ref && Object.prototype.hasOwnProperty.call(PUSH_PUBLIC_KEYS, ref)
    ? PUSH_PUBLIC_KEYS[ref]
    : null
}
