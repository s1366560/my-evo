import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Resolve lockfile conflict in monorepo: treat frontend/ as standalone project root
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
