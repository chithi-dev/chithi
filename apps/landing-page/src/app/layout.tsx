import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/providers/ProgressProvider';

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

import StyledJsxRegistry from './registry';
export const metadata: Metadata = {
    title: 'Chithi - Secure File Sharing',
    description: 'Self-hostable, encrypted file sharing for humans.',
    icons: {
        icon: '/favicon.svg',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.svg" />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
            >
                <StyledJsxRegistry>
                    <Providers>{children}</Providers>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}
