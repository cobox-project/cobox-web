import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages does not support Next.js built-in image optimization.
  // Use unoptimized mode (or add Cloudflare Image Resizing later).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
