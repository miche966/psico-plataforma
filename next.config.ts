import type { NextConfig } from "next";

const SUPABASE_ORIGIN = "https://wzhdidxssnwfvzzapfwu.supabase.co";
// El bucket de R2 es privado: los videos (subida y lectura) van solo por URL firmada. Esas URLs llevan el
// bucket como subdominio (host distinto del endpoint de la cuenta) y la CSP exige host exacto. Sin comodin:
// un comodin permitiria subir a cualquier cuenta de R2.
const R2_FIRMADO_ORIGIN = "https://video-psicoplataforma.8c662e7d3be33f7a66b01eefc1f0a051.r2.cloudflarestorage.com";
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  `media-src 'self' blob: ${SUPABASE_ORIGIN} ${R2_FIRMADO_ORIGIN}`,
  `connect-src 'self' ${SUPABASE_ORIGIN} ${R2_FIRMADO_ORIGIN}`,
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
