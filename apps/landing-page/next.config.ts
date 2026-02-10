import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    output: 'standalone',
    images: {
        formats: ['image/avif'],
    },
    experimental: {
        optimizeServerReact: true,
    },
    productionBrowserSourceMaps: true,
    reactCompiler: true,
};

export default nextConfig;
