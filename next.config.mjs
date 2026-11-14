// Security headers sent with every response. These are deliberately the ones that
// cannot break the existing app: no framing by other sites, no MIME sniffing, a
// limited referrer, only the browser features Food4Love uses, and a short list of
// Content-Security-Policy directives that do not restrict scripts or styles.
// A full script-src policy needs a nonce rollout (Next.js inline scripts) and is a
// separate, tested project: see the audit report.
export const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), microphone=(self), geolocation=(self), payment=(self), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not advertise the framework version in a response header.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Allow Replit's proxied preview to connect
  allowedDevOrigins: ['*'],
}

export default nextConfig
