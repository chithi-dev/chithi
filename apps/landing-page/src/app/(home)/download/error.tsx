'use client';

import { AlertTriangle } from 'lucide-react';

type Props = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function DownloadError({ error, reset }: Props) {
    const isRateLimited = error.message === 'RATE_LIMIT';

    return (
        <main className="fixed inset-0 z-60 flex min-h-screen w-full items-center justify-center bg-surface-950/95 px-6 py-12 text-center backdrop-blur-sm">
            <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-error-500/10 blur-[100px]" />

            <div className="card preset-outlined-surface-200-800 flex w-full max-w-lg flex-col items-center space-y-6 bg-surface-100-900/30 p-10 shadow-2xl sm:p-14">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-500/10 text-error-500">
                    <AlertTriangle size={32} />
                </div>

                <h1 className="h2 font-bold tracking-tighter">
                    {isRateLimited ? 'Rate Limited' : 'Temporarily Unavailable'}
                </h1>

                <p className="text-lg text-surface-600-400 leading-relaxed">
                    {isRateLimited
                        ? 'GitHub API rate limit exceeded. Please try again later or configure a token.'
                        : 'Failed to fetch the latest Chithi CLI releases from GitHub. Please try again in a moment.'}
                </p>

                {isRateLimited && (
                    <div className="mt-4 w-full rounded-xl bg-surface-950 p-4 text-left font-mono text-sm text-surface-400">
                        <div className="mb-2 font-bold text-surface-500 text-xs uppercase tracking-widest">
                            Local Fix (.env)
                        </div>
                        <span className="text-primary-500">GITHUB_TOKEN</span>
                        =ghp_YOUR_TOKEN
                    </div>
                )}

                <button
                    type="button"
                    className="btn preset-filled w-full max-w-xs font-bold"
                    onClick={() => reset()}
                >
                    Try Again
                </button>
            </div>
        </main>
    );
}
