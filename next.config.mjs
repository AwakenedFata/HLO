/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose'],

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,

  poweredByHeader: false,
  compress: true,

  images: {
    domains: ['placeholder.com'],
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|mp4|webp)$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[hash][ext]',
      },
    })

    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '.',
    }

    return config
  },
}

export default nextConfig
