import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  outputFileTracingRoot: __dirname,
  experimental: {
    turbo: undefined,
  },

  // ===== PERFORMANCE: Code Splitting & Lazy Loading =====
  modularizeImports: {
    // Tree-shakeable icon imports for smaller bundles
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
    // Split heavy UI libraries
    '@radix-ui/react-dialog': {
      transform: '@radix-ui/react-dialog/dist/index.module.js',
    },
    '@radix-ui/react-dropdown-menu': {
      transform: '@radix-ui/react-dropdown-menu/dist/index.module.js',
    },
  },

  // ===== PERFORMANCE: Image Optimization =====
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'images.unsplash.com',
      'picsum.photos',
      'avatars.githubusercontent.com',
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },

  // ===== PERFORMANCE: Compression =====
  compress: true,

  // ===== PERFORMANCE: Headers for caching & security =====
  async headers() {
    return [
      {
        // CDN and browser caching for static assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache hashed assets aggressively
        source: '/_next/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes: no cache by default (or use stale-while-revalidate)
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
      {
        // Static pages: cache with revalidation
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=86400',
          },
        ],
      },
      // Security headers
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },

  // ===== PERFORMANCE: Build optimizations =====
  poweredByHeader: false,

  // ===== PERFORMANCE: Bundle analysis and optimization =====
  // Enable strict mode for better tree-shaking
  swcMinify: true,

  // ===== PERFORMANCE: React strict mode for development =====
  reactStrictMode: true,

  // ===== PERFORMANCE: Production source maps (optional, for debugging) =====
  productionBrowserSourceMaps: false,

  // ===== PERFORMANCE: Generate bundle stats for analysis =====
  // Bundle analysis: analyze with `ANALYZE=true npm run build`

  // ===== PERFORMANCE: Redirects for SEO =====
  async redirects() {
    return [
      {
        source: '/index',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
