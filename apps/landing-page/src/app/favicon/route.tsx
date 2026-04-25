import { ImageResponse } from 'next/og';
import Favicon from '@/icons/favicon';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = {
    width: 32,
    height: 32,
};

export async function GET() {
    try {
        return new ImageResponse(<Favicon />, {
            ...size,
        });
    } catch (err) {
        console.error('OG favicon generation error:', err);
        return new Response('Failed to generate favicon', { status: 500 });
    }
}
