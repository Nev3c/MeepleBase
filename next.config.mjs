/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Google Profilbilder (OAuth)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // BoardGameGeek Cover-Bilder
        protocol: "https",
        hostname: "cf.geekdo-images.com",
      },
      {
        // BGG (älteres CDN)
        protocol: "https",
        hostname: "*.geekdo-images.com",
      },
      {
        // Supabase Storage (eigene Bilder)
        protocol: "https",
        hostname: "jzgurmmpbjjqhxdbefpc.supabase.co",
      },
    ],
  },
};

export default nextConfig;
