/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/NobiMath',
  assetPrefix: '/NobiMath',
  trailingSlash: true,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
}

export default nextConfig
