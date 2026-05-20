import { createRequire } from "module";
import createNextIntlPlugin from "next-intl/plugin";
import runtimeCaching from "./src/lib/sw/runtime-caching.mjs";

const require = createRequire(import.meta.url);
// next-pwa is published as CommonJS; createRequire is the safest interop.
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  // We never want auth or webhook routes to land in the SW cache.
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ["!noprecache/**/*"],
  runtimeCaching,
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(withPWA(nextConfig));
