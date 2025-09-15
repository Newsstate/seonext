// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    // Make sure chromium's binary + shared libs are traced into the function
    outputFileTracingIncludes: {
      'app/api/render-compare/route': [
        './node_modules/@sparticuz/chromium/bin/*',
        './node_modules/@sparticuz/chromium/lib/*',
      ],
      // Add any other Puppeteer routes too:
      // 'app/api/amp-compare/route': [
      //   './node_modules/@sparticuz/chromium/bin/*',
      //   './node_modules/@sparticuz/chromium/lib/*',
      // ],
    },
  },
};

export default nextConfig;
