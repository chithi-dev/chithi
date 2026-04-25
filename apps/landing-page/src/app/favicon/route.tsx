import { ImageResponse } from 'next/og';
import Favicon from '@/icons/favicon';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
    try {
        return new ImageResponse(<Favicon width={32} height={32} />, {
            width: 32,
            height: 32,
        });
    } catch (err) {
        console.error('OG favicon generation error:', err);
        return new Response('Failed to generate favicon', { status: 500 });
    }
}
