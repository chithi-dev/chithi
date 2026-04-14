import type { Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/providers/ProgressProvider';
import StyledJsxRegistry from '@/registry/styled-jsx';

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

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
        <html lang="en" data-theme="cerberus" className="dark">
            <head>
                <link rel="icon" href="/favicon.svg" />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} bg-surface-50-950 text-surface-950-50 antialiased selection:bg-primary-500 selection:text-[#171717]`}
            >
                <StyledJsxRegistry>
                    <Providers>{children}</Providers>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}
