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
    return [
      {
        source: '/api/frontend/:path*',
        destination: 'http://localhost:4000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
