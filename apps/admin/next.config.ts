import type { NextConfig } from 'next'

const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:4000'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Allow preview via *.monkeycode-ai.live domains during local development
  allowedDevOrigins: ['**.monkeycode-ai.live'],

  async rewrites() {
    // Reverse proxy: forward /api/* and /uploads/* to the backend so the
    // browser talks to a single origin (avoids CORS + cookies and keeps
    // uploaded media same-origin). Applies in dev and in production servers.
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${API_PROXY_TARGET}/uploads/:path*`
      }
    ]
  }
}

export default nextConfig
