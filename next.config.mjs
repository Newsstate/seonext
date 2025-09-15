/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    // Let Next bundle these native deps into the serverless function
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],

    // ⛔️ Do NOT add outputFileTracingIncludes to "app/api/bin"
    // If you *ever* need manual include (usually not necessary), only include node_modules:
    // outputFileTracingIncludes: {
    //   'app/api/render-compare/route': [
    //     './node_modules/@sparticuz/chromium/bin/*',
    //     './node_modules/@sparticuz/chromium/lib/*',
    //   ],
    //   'app/api/amp-compare/route': [
    //     './node_modules/@sparticuz/chromium/bin/*',
    //     './node_modules/@sparticuz/chromium/lib/*',
    //   ],
    // },
  },
};

export default nextConfig;
