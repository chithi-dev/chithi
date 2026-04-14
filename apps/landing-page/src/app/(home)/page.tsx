import { Metadata, Viewport } from 'next';
import HomeClient from './page.client';
import { octokit } from '@/server/providers/octokit.server';

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
    ],
};

export const metadata: Metadata = {
    title: {
        default: 'Chithi — Secure, self-hosted encrypted file sharing',
        template: '%s | Chithi',
    },
    description:
        'Self-hostable, end-to-end encrypted file sharing focused on privacy and simplicity.',
    applicationName: 'Chithi',
    keywords: [
        'file sharing',
        'encrypted',
        'self-hosted',
        'privacy',
        'open-source',
    ],
    authors: [{ name: 'Chithi', url: 'https://github.com/chithi-dev' }],
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/apple-touch-icon.png',
    },
    openGraph: {
        title: 'Chithi — Secure file sharing',
        description:
            'Self-hostable, end-to-end encrypted file sharing focused on privacy and simplicity.',
        type: 'website',
        siteName: 'Chithi',
        images: [
            {
                url: '/public_instances/desktop/chithi.png',
                width: 1200,
                height: 630,
                alt: 'Chithi — Secure File Sharing',
            },
        ],
    },
    robots: {
        index: true,
        follow: true,
        nocache: false,
    },
};

export default async function Page() {
    let release = null;
    try {
        const { data } = await octokit.rest.repos.getLatestRelease({
            owner: 'chithi-dev',
            repo: 'chithi',
        });
        release = data;
    } catch (err) {
        release = null;
    }

    return <HomeClient release={release} />;
}
