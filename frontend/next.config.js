/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: Removed output: 'export' to enable API routes and SSR on Vercel
  // output: 'export' makes Next.js static-only, breaking /api/* routing
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app',
  },
}

module.exports = nextConfig
