import { ImageResponse } from 'next/og';
import SVGComponent from '@/icons/favicon';

export const runtime = 'edge';

export async function GET() {
  try {
    return new ImageResponse(<SVGComponent />, {
      width: 32,
      height: 32,
    });
  } catch (err) {
    console.error('OG favicon generation error:', err);
    return new Response('Failed to generate favicon', { status: 500 });
  }
}
