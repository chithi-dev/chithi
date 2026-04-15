'use client';

import { AppBar } from '@skeletonlabs/skeleton-react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, GitBranch } from 'lucide-react';
import { SiGithub } from '@icons-pack/react-simple-icons';

type GithubRepoData = {
    stargazerCount: number;
    forkCount: number;
    latestRelease: {
        tagName: string;
    } | null;
} | null;

type Props = {
    repo?: GithubRepoData;
};

export function Navbar({ repo }: Props) {
    const mapping = [
        {
            href: 'https://github.com/chithi-dev/chithi',
            icon: {
                component: SiGithub,
                size: 16,
            },
            label: 'GitHub Repo',
            value: repo?.latestRelease?.tagName,
        },
        {
            href: 'https://github.com/chithi-dev/chithi/stargazers',
            icon: {
                component: Star,
                size: 14,
            },
            label: 'Stars',
            value: repo?.stargazerCount,
        },
        {
            href: 'https://github.com/chithi-dev/chithi/network/members',
            icon: {
                component: GitBranch,
                size: 14,
            },
            label: 'Forks',
            value: repo?.forkCount,
        },
    ];

    return (
        <div className="sticky top-0 z-50 border-surface-200-800/50 border-b bg-transparent backdrop-blur-md">
            <AppBar className="mx-auto w-full max-w-7xl bg-transparent">
                <AppBar.Toolbar className="grid-cols-[auto_1fr_auto]">
                    <AppBar.Lead>
                        <Link
                            href="/"
                            className="flex items-center gap-3"
                            aria-label="Go to homepage"
                        >
                            <Image
                                width={28}
                                height={28}
                                alt="logo"
                                src="/favicon.svg"
                                className="dark:invert-0"
                            />
                            <span className="font-bold text-base tracking-tight">
                                CHITHI
                            </span>
                        </Link>
                    </AppBar.Lead>
                    <AppBar.Headline></AppBar.Headline>
                    <AppBar.Trail>
                        {mapping.map((item, i) => {
                            const icon = item.icon;
                            return (
                                <a
                                    key={i}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={item.label}
                                    className="btn btn-sm ml-2 flex items-center gap-2 rounded-full border border-surface-200-800 px-3 transition-all hover:bg-surface-200-800/40"
                                >
                                    <icon.component size={icon.size} />
                                    {item.value != null && (
                                        <span className="text-sm opacity-70">
                                            {item.value}
                                        </span>
                                    )}
                                </a>
                            );
                        })}
                    </AppBar.Trail>
                </AppBar.Toolbar>
            </AppBar>
        </div>
    );
}

export function Footer() {
    return (
        <footer className="border-surface-200-800 border-t bg-surface-50-950 px-6 py-12">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
                <div className="font-bold text-sm text-surface-600-400 tracking-widest">
                    CHITHI PROJECT
                </div>
                <div className="flex gap-8 font-medium text-sm text-surface-500-400">
                    <Link
                        href="#"
                        className="transition-colors hover:text-primary-500"
                    >
                        Updates
                    </Link>
                    <Link
                        href="#"
                        className="transition-colors hover:text-primary-500"
                    >
                        Privacy Policy
                    </Link>
                    <Link
                        href="#"
                        className="transition-colors hover:text-primary-500"
                    >
                        Terms of Service
                    </Link>
                </div>
            </div>
        </footer>
    );
}

export default function HomeLayoutClient({
    children,
    repo = null,
}: Readonly<{
    children: React.ReactNode;
    repo?: GithubRepoData | null;
}>) {
    return (
        <div className="min-h-screen overflow-x-hidden font-sans text-surface-900-100">
            <Navbar repo={repo} />
            {children}
            <Footer />
        </div>
    );
}
