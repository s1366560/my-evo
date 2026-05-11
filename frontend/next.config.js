/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    // Remove console.log in production (except errors)
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  experimental: {
    // Enable optimized package imports for tree-shaking
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async rewrites() {
    // API routes under /api/frontend/ are handled by Next.js route.ts handlers
    // No rewrites needed - route.ts files proxy to BACKEND_URL
    return [];
  },
};

module.exports = nextConfig;
