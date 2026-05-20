// Workbox RuntimeCaching config consumed by `withPWA` in next.config.mjs.
//
// Loaded at build time (Node, ESM), NOT at request time — keep this file
// dependency-free. The matching service worker is regenerated whenever
// `next build` runs with `process.env.NODE_ENV === 'production'`.
//
// Strategy summary (top-to-bottom; first match wins inside workbox):
//   1. Lesson assets (PDF / audio / video / WebP / images) served from R2
//      via a long-lived public URL → CacheFirst (offline-friendly).
//   2. /api/lessons/.../sign (presigned R2 redirects) → NetworkOnly. The
//      signed URLs expire, caching the redirect would lock users into a
//      stale presign once they go online again.
//   3. Static fonts → CacheFirst.
//   4. Google Fonts CSS / WOFF → StaleWhileRevalidate.
//   5. Page documents (HTML) → NetworkFirst with a 5s timeout so users on
//      flaky links still see the cached shell.
//   6. Static images (icons, OG previews) → StaleWhileRevalidate.
//
// All other navigation falls through to workbox's default precache (which
// covers the Next build output) plus the network.

/** @type {import('workbox-build').RuntimeCaching[]} */
const runtimeCaching = [
  {
    urlPattern: /\.(?:pdf|mp3|m4a|webm|mp4)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "resoul-lesson-media",
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      },
      cacheableResponse: { statuses: [0, 200] },
      rangeRequests: true,
    },
  },
  {
    urlPattern: /^\/api\/lessons\/[^/]+\/sign(?:\?.*)?$/,
    handler: "NetworkOnly",
    method: "GET",
  },
  {
    urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "resoul-fonts",
      expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "google-fonts-stylesheets",
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts-webfonts",
      expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: ({ request }) => request.destination === "document",
    handler: "NetworkFirst",
    options: {
      cacheName: "resoul-pages",
      networkTimeoutSeconds: 5,
      expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "resoul-images",
      expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
];

export default runtimeCaching;
