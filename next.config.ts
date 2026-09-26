import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from Supabase Storage (*.supabase.co) and all subdomains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/**',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
