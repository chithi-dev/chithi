import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    output: 'standalone',
    // cacheComponents: true,
    images: {
        formats: ['image/avif'],
    },
    experimental: {
        optimizeServerReact: true,
    },
    compiler: {
        styledJsx: true,
    },
    productionBrowserSourceMaps: true,
    reactCompiler: {
        compilationMode: 'annotation',
    },
};

export default nextConfig;
