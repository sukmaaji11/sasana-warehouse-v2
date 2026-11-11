import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Shared packages diekspor sebagai source TypeScript.
  transpilePackages: [
    '@sasana/shared-api',
    '@sasana/shared-constants',
    '@sasana/shared-types',
    '@sasana/shared-validation',
  ],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
