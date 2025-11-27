/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },

  serverExternalPackages: ["mongoose"],

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
    domains: ["placeholder.com"],
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
  },

  env: {
    NEXT_PUBLIC_FRONTEND_URL:
      process.env.FRONTEND_URL || "http://localhost",
  },

  async headers() {
    return [
      // API routes security headers
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      // PDF API with caching for performance
      {
        source: "/api/verification-pdf",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      // Static assets - long-term caching
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // General security headers
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ]
  },

  webpack(config, { isServer }) {
    // Existing asset handling
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|mp4|webp|glb|gltf)$/i,
      type: "asset/resource",
      generator: {
        filename: "static/media/[hash][ext]",
      },
    })

    // Fix for React-PDF (canvas module)
    config.resolve.alias.canvas = false

    // Optimize for serverless (React-PDF)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        canvas: false,
      }
    }

    // Existing alias
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": ".",
    }

    return config
  },
}

export default nextConfig