import { createRequire } from "module";
import createNextIntlPlugin from "next-intl/plugin";
import runtimeCaching from "./src/lib/sw/runtime-caching.mjs";

const require = createRequire(import.meta.url);
// next-pwa is published as CommonJS; createRequire is the safest interop.
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // next-pwa's App-Router register-script injection is broken upstream
  // (it relies on `pages/_document`); we register /sw.js ourselves from
  // <RegisterSW /> in the locale layout.
  register: false,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  // We never want auth or webhook routes to land in the SW cache.
  // app-build-manifest.json is generated for the dev server only and 404s
  // under `next start`; precaching it would break SW install.
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  publicExcludes: ["!noprecache/**/*"],
  runtimeCaching,
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(withPWA(nextConfig));
