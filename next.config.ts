
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // IMPORTANT: For dynamically sourced images from various RSS feeds,
      // next/image requires their hostnames to be whitelisted here.
      // Since these hostnames are unknown in advance and can be numerous,
      // you will need to add them as you discover them from your feed sources
      // if you want Next.js image optimization for them.
      // Example:
      // {
      //   protocol: 'https',
      //   hostname: 'some-news-cdn.com',
      //   port: '',
      //   pathname: '/**',
      // },
      // Using a wildcard like '*' for hostname is possible but generally
      // discouraged for security reasons and can impact build performance.
      // If this becomes too restrictive, consider using standard <img> tags
      // for images from arbitrary external sources, sacrificing optimization.
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
      "https://story.sekiz.in",
      // Add any other development origins you might use here
    ],
  },
};

export default nextConfig;
