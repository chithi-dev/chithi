import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    output: 'standalone',
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'github.com',
                pathname: '/chithi-dev/chithi/raw/main/assets/**',
            },
        ],
    },
    experimental: {
        optimizeServerReact: true,
    },
    productionBrowserSourceMaps: true,
    reactCompiler: true,
};

export default nextConfig;
