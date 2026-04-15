import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Spielcover von BGG CDN — Cache First (Bilder ändern sich kaum)
      {
        urlPattern: /^https:\/\/cf\.geekdo-images\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "bgg-images",
          expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Supabase Storage (eigene Bilder) — Cache First
      {
        urlPattern: /^https:\/\/jzgurmmpbjjqhxdbefpc\.supabase\.co\/storage\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-storage",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Supabase REST API — Network First (frisch wenn online, Cache offline)
      {
        urlPattern: /^https:\/\/jzgurmmpbjjqhxdbefpc\.supabase\.co\/rest\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
          networkTimeoutSeconds: 10,
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Google Fonts — Cache First
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Next.js static assets — Cache First
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Next.js Image Optimization
      {
        urlPattern: /\/_next\/image\?.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-image",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

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

export default withPWA(nextConfig);
