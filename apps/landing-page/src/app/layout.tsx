import '@/css/globals.css';
import "@/css/fonts.scss"

import type { Viewport } from 'next';
import Providers from '@/providers/ProgressProvider';
import StyledJsxRegistry from '@/registry/styled-jsx';

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
                className={`bg-surface-50-950 text-surface-950-50 antialiased selection:bg-primary-500 selection:text-[#171717]`}
            >
                <StyledJsxRegistry>
                    <Providers>{children}</Providers>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}
