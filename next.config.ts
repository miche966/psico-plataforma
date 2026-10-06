import type { NextConfig } from "next";
import { construirCsp } from './lib/server/csp.ts'

// La politica se arma en lib/server/csp.ts (misma fuente para esta cabecera y para la estricta del proxy)
const CSP = construirCsp({ dev: process.env.NODE_ENV !== 'production' })

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
