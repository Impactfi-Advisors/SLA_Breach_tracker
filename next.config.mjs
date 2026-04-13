/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', 'imapflow'],
    instrumentationHook: true,
  },
}

export default nextConfig
