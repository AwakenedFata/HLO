/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserve your existing configurations
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  
  // Security and performance improvements from migration
  poweredByHeader: false,
  compress: true,
  
  // Preserve your image configuration with additions
  images: {
    domains: ["placeholder.com"],
    unoptimized: true,
  },
  
  // Environment variables that should be available to the client
  env: {
    NEXT_PUBLIC_FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  },
  
  // Custom headers for security (enhanced)
  async headers() {
    return [
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
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: process.env.NODE_ENV === "production" 
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.hoklampung.com;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://api.hoklampung.com;"
          }
        ],
      },
    ]
  },
  
  // Preserve your webpack configuration
  webpack(config) {
    // Configuration for handling asset imports directly
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|mp4|webp)$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[hash][ext]',
      },
    });
    
    // Add resolver for @/ path alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '.',
    };
    
    return config;
  },
  
  // Preserve trailing slash configuration
  trailingSlash: true,
};

// ES module export syntax
export default nextConfig;
