// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      // Include for both the folder and the route file to be extra-safe
      'app/api/render-compare': ['./node_modules/@sparticuz/chromium/**/*'],
      'app/api/render-compare/route.ts': ['./node_modules/@sparticuz/chromium/**/*'],
    },
  },
};

export default nextConfig;
