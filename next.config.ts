import type { NextConfig } from "next";
import { construirCsp, modoCsp } from './lib/server/csp.ts'

// Politica vigente (con 'unsafe-inline'): salvo en modo estricta, donde el proxy publica la unica politica (ver lib/server/csp.ts)
const CSP_VIGENTE = modoCsp() === 'estricta' ? [] : [{ key: 'Content-Security-Policy', value: construirCsp({ dev: process.env.NODE_ENV !== 'production' }) }]

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
          ...CSP_VIGENTE,
        ],
      },
    ]
  },
};

export default nextConfig;
