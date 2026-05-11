/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'note.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
