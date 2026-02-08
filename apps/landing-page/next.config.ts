import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    output: 'export',
    experimental: {
        optimizeServerReact: true,
    },
    reactCompiler: true,
};

export default nextConfig;
