// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    // ✅ Ensure the Lambda-friendly Chromium + puppeteer-core are bundled
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      // 👇 path to your API route file
      'app/api/render-compare/route.ts': [
        './node_modules/@sparticuz/chromium/**/*',
      ],
    },
  },
};

export default nextConfig;
