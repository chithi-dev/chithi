import type { Metadata } from 'next';
import { JetBrains_Mono, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Chithi - Secure File Sharing',
    description: 'Self-hostable, encrypted file sharing for humans.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" data-theme="nouveau">
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
