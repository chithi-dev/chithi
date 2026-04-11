'use client';

import { Avatar, Tabs } from '@skeletonlabs/skeleton-react';
import { DownloadIcon, MonitorIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';
import type { Octokit } from 'octokit';

type OctokitRelease = Awaited<
    ReturnType<Octokit['rest']['repos']['listReleases']>
>['data'][number];

export default function DownloadView({
    releases,
}: {
    releases: OctokitRelease[];
}) {
    const [tabOS, setTabOS] = useState('windows');
    const [selectedReleaseIndex, setSelectedReleaseIndex] = useState(0);

    if (!releases || releases.length === 0) {
        return <div>No releases found.</div>;
    }

    const release = releases[selectedReleaseIndex];

    const assets = release.assets ?? [];
    const windows = assets.filter((a) =>
        a.name.toLowerCase().includes('windows'),
    );
    const macos = assets.filter(
        (a) =>
            a.name.toLowerCase().includes('macos') ||
            a.name.toLowerCase().includes('darwin'),
    );
    const linux = assets.filter((a) => a.name.toLowerCase().includes('linux'));

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
                                    {rel.name ?? rel.tag_name ?? `#${rel.id}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-4 text-surface-800-200">
                        <Avatar className="size-10">
                            <Avatar.Image
                                src={release.author?.avatar_url ?? ''}
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
                                {release.published_at
                                    ? new Date(
                                          release.published_at,
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
                            className="btn preset-tonal data-[state=active]:preset-filled min-w-32 flex-1 md:flex-none"
                        >
                            <MonitorIcon className="mr-2 size-4" /> Windows
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="macos"
                            className="btn preset-tonal data-[state=active]:preset-filled min-w-32 flex-1 md:flex-none"
                        >
                            <TerminalIcon className="mr-2 size-4" /> macOS
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="linux"
                            className="btn preset-tonal data-[state=active]:preset-filled min-w-32 flex-1 md:flex-none"
                        >
                            <TerminalIcon className="mr-2 size-4" /> Linux
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

function AssetGrid({
    assets,
}: {
    assets: {
        id: number;
        name: string;
        size: number;
        download_count: number;
        browser_download_url: string;
    }[];
}) {
    if (!assets || assets.length === 0) {
        return (
            <div className="card preset-filled-surface-100-900 mx-auto flex max-w-xl flex-col items-center justify-center p-12 text-center opacity-70">
                <TerminalIcon className="mb-4 size-10 opacity-50" />
                <p>No assets available for this platform.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
            {assets.map((asset) => (
                <div
                    key={asset.id}
                    className="card preset-outlined-surface-200-800 flex flex-col justify-between bg-surface-50-950 p-6 transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                    <div className="mb-6 flex flex-col gap-2">
                        <h3 className="h4 break-all font-bold">{asset.name}</h3>
                        <div className="flex gap-2">
                            <span className="badge preset-tonal-surface rounded-lg py-1 text-xs">
                                {(asset.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            <span className="badge preset-tonal-surface rounded-lg py-1 text-xs">
                                {asset.download_count} Downloads
                            </span>
                        </div>
                    </div>
                    <a
                        href={asset.browser_download_url}
                        className="btn preset-filled w-full font-bold"
                    >
                        <DownloadIcon className="mr-2 size-4" /> Download
                    </a>
                </div>
            ))}
        </div>
    );
}
