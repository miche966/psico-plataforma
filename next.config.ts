import type { NextConfig } from "next";

const SUPABASE_ORIGIN = "https://wzhdidxssnwfvzzapfwu.supabase.co";
const R2_PUBLIC_ORIGIN = "https://pub-8c13e3844d9c4aa0b884ae0b3c1093e3.r2.dev";
const R2_UPLOAD_ORIGIN = "https://8c662e7d3be33f7a66b01eefc1f0a051.r2.cloudflarestorage.com";
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} ${R2_PUBLIC_ORIGIN}`,
  `media-src 'self' blob: ${SUPABASE_ORIGIN} ${R2_PUBLIC_ORIGIN}`,
  `connect-src 'self' ${SUPABASE_ORIGIN} ${R2_PUBLIC_ORIGIN} ${R2_UPLOAD_ORIGIN}`,
  "font-src 'self'",
  "object-src 'none'",
  `frame-src ${TURNSTILE_ORIGIN}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ]
  },
};

export default nextConfig;
