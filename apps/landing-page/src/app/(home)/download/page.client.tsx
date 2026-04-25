'use client';

import { Avatar, Tabs } from '@skeletonlabs/skeleton-react';
import { DownloadIcon, MonitorIcon, TerminalIcon, Cpu } from 'lucide-react';
import * as SIIcons from '@icons-pack/react-simple-icons';
import { useState } from 'react';
import type { ElementType } from 'react';
import type { GithubAsset, GithubRelease } from './types';

const resolveSIIcon = (names: string[], fallback: ElementType): ElementType => {
    for (const n of names) {
        const comp = SIIcons[n as keyof typeof SIIcons];
        if (comp) return comp as unknown as ElementType;
    }
    return fallback;
};

const WindowsTabIcon = resolveSIIcon(
    ['SiWindows', 'Windows', 'MicrosoftWindows', 'Windows10'],
    MonitorIcon,
);
const MacTabIcon = resolveSIIcon(
    ['SiApple', 'Apple', 'MacOS', 'Macintosh'],
    TerminalIcon,
);
const LinuxTabIcon = resolveSIIcon(
    ['SiLinux', 'Linux', 'Tux', 'SiUbuntu', 'Ubuntu'],
    TerminalIcon,
);

export default function DownloadView({
    releases,
}: {
    releases: GithubRelease[];
}) {
    const [tabOS, setTabOS] = useState('windows');
    const [selectedReleaseIndex, setSelectedReleaseIndex] = useState(0);

    if (!releases || releases.length === 0) {
        return <div>No releases found.</div>;
    }

    const release = releases[selectedReleaseIndex];

    const assets = release.releaseAssets?.nodes ?? [];

    // Tokenize asset names into a Set for reliable platform detection.
    const tokenizeName = (name?: string) =>
        new Set(
            (name ?? '')
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter(Boolean),
        );

    const windows = assets.filter((a) => {
        const tokens = tokenizeName(a.name);
        return tokens.has('windows') || tokens.has('win');
    });
    const macos = assets.filter((a) => {
        const tokens = tokenizeName(a.name);
        return tokens.has('macos') || tokens.has('darwin') || tokens.has('mac');
    });
    const linux = assets.filter((a) => {
        const tokens = tokenizeName(a.name);
        return tokens.has('linux');
    });

    return (
        <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-24 pb-20 md:pt-40 md:pb-32">
            {/* Ambient Background Glow matching the homepage */}
            <div className="pointer-events-none absolute top-1/4 left-1/2 -z-10 h-75 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-900-100 opacity-10 blur-[100px] md:opacity-15 md:blur-[150px]" />

            <div className="mb-12 text-center">
                <div className="badge preset-outlined-surface-200-800 mb-8 rounded-full font-medium tracking-wide">
                    Releases
                </div>
                <h1 className="mb-6 font-bold text-5xl leading-tight tracking-tighter md:text-7xl">
                    Download{' '}
                    <span className="text-surface-600-400">Chithi</span>
                </h1>
                <p className="mx-auto max-w-2xl font-light text-surface-600-400 text-xl leading-relaxed">
                    Select a release variation and choose your platform to
                    download the CLI binaries.
                </p>
            </div>

            <div className="space-y-12">
                <section className="flex flex-col items-center space-y-4">
                    <div className="flex w-full max-w-sm flex-col space-y-2">
                        <label
                            htmlFor="release-select"
                            className="font-semibold text-sm text-surface-600-400"
                        >
                            Select Release Variation
                        </label>
                        <select
                            id="release-select"
                            className="select variant-form-material w-full"
                            value={selectedReleaseIndex}
                            onChange={(e) =>
                                setSelectedReleaseIndex(Number(e.target.value))
                            }
                        >
                            {releases.map((rel, index) => (
                                <option key={rel.id} value={index}>
                                    {rel.name ?? rel.tagName ?? `#${rel.id}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-4 text-surface-800-200">
                        <Avatar className="size-10">
                            <Avatar.Image
                                src={release.author?.avatarUrl ?? ''}
                                alt={release.author?.login ?? 'author'}
                            />
                            <Avatar.Fallback>
                                {(release.author?.login ?? '??')
                                    .substring(0, 2)
                                    .toUpperCase()}
                            </Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col text-sm">
                            <span className="font-bold">
                                {release.author?.login ?? 'Unknown'}
                            </span>
                            <span className="opacity-60">
                                Published on{' '}
                                {release.publishedAt
                                    ? new Date(
                                          release.publishedAt,
                                      ).toLocaleDateString()
                                    : 'Unknown'}
                            </span>
                        </div>
                    </div>
                </section>

                <Tabs
                    value={tabOS}
                    onValueChange={(d) => setTabOS(d.value)}
                    className="w-full"
                >
                    <Tabs.List className="mb-8 w-full justify-center space-x-2 md:space-x-8">
                        <Tabs.Trigger
                            value="windows"
                            className="btn min-w-32 flex-1 md:flex-none text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 data-[state=active]:text-surface-950 dark:data-[state=active]:text-surface-50 transition-colors"
                        >
                            <WindowsTabIcon className="mr-2 size-5" />
                            <span className="font-semibold">Windows</span>
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="macos"
                            className="btn min-w-32 flex-1 md:flex-none text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 data-[state=active]:text-surface-950 dark:data-[state=active]:text-surface-50 transition-colors"
                        >
                            <MacTabIcon className="mr-2 size-5" />
                            <span className="font-semibold">macOS</span>
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="linux"
                            className="btn min-w-32 flex-1 md:flex-none text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 data-[state=active]:text-surface-950 dark:data-[state=active]:text-surface-50 transition-colors"
                        >
                            <LinuxTabIcon className="mr-2 size-5" />
                            <span className="font-semibold">Linux</span>
                        </Tabs.Trigger>
                        <Tabs.Indicator className="rounded bg-primary-500" />
                    </Tabs.List>

                    <Tabs.Content
                        value="windows"
                        className="fade-in animate-in duration-300"
                    >
                        <AssetGrid assets={windows} />
                    </Tabs.Content>
                    <Tabs.Content
                        value="macos"
                        className="fade-in animate-in duration-300"
                    >
                        <AssetGrid assets={macos} />
                    </Tabs.Content>
                    <Tabs.Content
                        value="linux"
                        className="fade-in animate-in duration-300"
                    >
                        <AssetGrid assets={linux} />
                    </Tabs.Content>
                </Tabs>
            </div>
        </main>
    );
}

function AssetGrid({ assets }: { assets: GithubAsset[] }) {
    if (!assets || assets.length === 0) {
        return (
            <div className="card preset-filled-surface-100-900 mx-auto flex max-w-xl flex-col items-center justify-center p-12 text-center opacity-70">
                <TerminalIcon className="mb-4 size-10 opacity-50" />
                <p>No assets available for this platform.</p>
            </div>
        );
    }

    const tokenizeName = (name?: string) =>
        new Set(
            (name ?? '')
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter(Boolean),
        );

    const detectAssetOS = (name?: string) => {
        const tokens = tokenizeName(name);
        if (
            tokens.has('windows') ||
            tokens.has('win') ||
            tokens.has('exe') ||
            tokens.has('msi')
        )
            return 'windows';
        if (
            tokens.has('macos') ||
            tokens.has('darwin') ||
            tokens.has('mac') ||
            tokens.has('dmg') ||
            tokens.has('pkg') ||
            tokens.has('osx')
        )
            return 'macos';
        if (
            tokens.has('linux') ||
            tokens.has('deb') ||
            tokens.has('rpm') ||
            tokens.has('appimage')
        )
            return 'linux';
        return 'unknown';
    };

    const detectAssetArch = (name?: string) => {
        const tokens = tokenizeName(name);
        if (
            tokens.has('aarch64') ||
            tokens.has('arm64') ||
            tokens.has('arm64v8')
        )
            return 'arm64';
        if (tokens.has('armv7') || tokens.has('armv7l') || tokens.has('armhf'))
            return 'armv7';
        if (tokens.has('amd64') || tokens.has('x86_64') || tokens.has('x64'))
            return 'x86_64';
        if (tokens.has('i386') || tokens.has('i686') || tokens.has('ia32'))
            return 'i386';
        return 'unknown';
    };

    const resolveIcon = (
        names: string[],
        fallback: ElementType,
    ): ElementType => {
        for (const n of names) {
            const comp = SIIcons[n as keyof typeof SIIcons];
            if (comp) return comp as unknown as ElementType;
        }
        return fallback;
    };

    const WindowsIcon = resolveIcon(
        ['Windows', 'SiWindows', 'MicrosoftWindows', 'Windows10'],
        MonitorIcon,
    );
    const MacIcon = resolveIcon(
        ['Apple', 'SiApple', 'MacOS', 'Macintosh'],
        TerminalIcon,
    );
    const LinuxIcon = resolveIcon(
        ['Linux', 'SiLinux', 'Tux', 'Ubuntu', 'SiUbuntu'],
        TerminalIcon,
    );

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
            {assets.map((asset) => {
                const os = detectAssetOS(asset.name);
                const arch = detectAssetArch(asset.name);
                const osDisplay =
                    os === 'macos'
                        ? 'macOS'
                        : os === 'windows'
                          ? 'Windows'
                          : os === 'linux'
                            ? 'Linux'
                            : 'Unknown';
                const archDisplay =
                    arch === 'x86_64'
                        ? 'x86_64'
                        : arch === 'arm64'
                          ? 'arm64'
                          : arch === 'armv7'
                            ? 'armv7'
                            : arch === 'i386'
                              ? 'i386'
                              : 'universal';

                return (
                    <div
                        key={asset.id}
                        className="card preset-outlined-surface-200-800 flex flex-col justify-between bg-surface-50-950 p-6 transition-transform hover:-translate-y-1 hover:shadow-lg"
                    >
                        <div className="mb-6 flex flex-col gap-2">
                            <h3 className="h4 break-all font-bold">
                                {asset.name}
                            </h3>
                            <div className="flex gap-2">
                                <span className="badge preset-tonal-surface rounded-lg py-1 text-xs">
                                    {(asset.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                                <span className="badge preset-tonal-surface rounded-lg py-1 text-xs">
                                    {asset.downloadCount} Downloads
                                </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="badge preset-tonal-surface rounded-lg py-1 text-xs inline-flex items-center gap-2">
                                    {(() => {
                                        const OSIcon =
                                            os === 'windows'
                                                ? WindowsIcon
                                                : os === 'macos'
                                                  ? MacIcon
                                                  : LinuxIcon;
                                        return <OSIcon className="size-4" />;
                                    })()}
                                    {osDisplay}
                                </span>
                                <span className="badge preset-tonal-surface rounded-lg py-1 text-xs inline-flex items-center gap-2">
                                    <Cpu className="size-4" />
                                    {archDisplay}
                                </span>
                            </div>
                        </div>
                        <a
                            href={asset.downloadUrl}
                            className="btn preset-filled w-full font-bold"
                        >
                            <DownloadIcon className="mr-2 size-4" /> Download
                        </a>
                    </div>
                );
            })}
        </div>
    );
}
