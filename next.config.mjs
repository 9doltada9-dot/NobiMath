const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export so the app can be hosted on GitHub Pages
  output: 'export',
  // Project pages live at https://<user>.github.io/NobiMath/ in production.
  // In local dev (npm run dev) we keep the root path so http://localhost:3000 works.
  basePath: isProd ? '/NobiMath' : '',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
