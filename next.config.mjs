/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      'app/api/render-compare/route.ts': [
        './node_modules/@sparticuz/chromium/**/*',
      ],
    },
  },
};

export default nextConfig;
