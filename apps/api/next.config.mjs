/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bind to localhost only for security
  // Next.js 15 uses server options differently; this is set via CLI or env
  experimental: {},
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
