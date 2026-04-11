'use client';

import { AppBar } from '@skeletonlabs/skeleton-react';
import Image from 'next/image';
import Link from 'next/link';
import { GithubIcon as Github } from '@/icons/github';
import { Star, GitBranch } from 'lucide-react';
import type { Octokit } from 'octokit';

type OctokitRelease = Awaited<
    ReturnType<Octokit['rest']['repos']['getLatestRelease']>
>['data'];
type OctokitRepo = Awaited<ReturnType<Octokit['rest']['repos']['get']>>['data'];

type Props = {
    release?: OctokitRelease | null;
    repo?: OctokitRepo | null;
};

export function Navbar({ release, repo }: Props) {
    return (
        <div className="sticky top-0 z-50 border-surface-200-800/50 border-b bg-transparent backdrop-blur-md">
            <AppBar className="mx-auto w-full max-w-7xl bg-transparent">
                <AppBar.Toolbar className="grid-cols-[auto_1fr_auto]">
                    <AppBar.Lead>
                        <Link href="/" className="flex items-center gap-3">
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
                        <a
                            href="https://github.com/chithi-dev/chithi"
                            className="btn btn-sm hover:preset-tonal flex items-center gap-2 rounded-full border border-surface-200-800 px-4 transition-colors"
                        >
                            <Github size={16} />
                            {release?.tag_name && (
                                <span className="opacity-50">
                                    {release.tag_name}
                                </span>
                            )}
                        </a>
                        <a
                            href="https://github.com/chithi-dev/chithi/stargazers"
                            className="btn btn-sm ml-2 flex items-center gap-2 rounded-full border border-surface-200-800 px-3 transition-colors"
                        >
                            <Star size={14} />
                            <span className="opacity-60 text-sm">
                                {repo?.stargazers_count ?? 0}
                            </span>
                        </a>

                        <a
                            href="https://github.com/chithi-dev/chithi/network/members"
                            className="btn btn-sm ml-2 flex items-center gap-2 rounded-full border border-surface-200-800 px-3 transition-colors"
                        >
                            <GitBranch size={14} />
                            <span className="opacity-60 text-sm">
                                {repo?.forks_count ?? 0}
                            </span>
                        </a>
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
    release,
    repo = null,
}: Readonly<{
    children: React.ReactNode;
    release?: OctokitRelease | null;
    repo?: OctokitRepo | null;
}>) {
    return (
        <div className="min-h-screen overflow-x-hidden font-sans text-surface-900-100">
            <Navbar release={release} repo={repo} />
            {children}
            <Footer />
        </div>
    );
}
