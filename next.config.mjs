/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['sports-unsigned-cloak.ngrok-free.dev'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
