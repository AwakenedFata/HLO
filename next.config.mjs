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
    unoptimized: false,

    formats: ["image/avif", "image/webp"],

    // Device sizes for responsive images (viewport widths)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for fixed-width images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Cache optimized images for 60 days (in seconds)
    minimumCacheTTL: 5184000,

    // Remote patterns for external images (more secure than domains)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholder.com",
      },
      {
        protocol: "https",
        hostname: "**.placeholder.com",
      },
      // Cloudflare R2 storage
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pub-82ea31cba2884e6f9eb6a652c0e2b97c.r2.dev",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  env: {
    NEXT_PUBLIC_FRONTEND_URL:
      process.env.FRONTEND_URL || "http://localhost",
  },

  async headers() {
    return [
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