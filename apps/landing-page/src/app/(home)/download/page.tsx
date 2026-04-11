import { AlertTriangle } from 'lucide-react';
import DownloadView from './page.client';
import { RequestError } from 'octokit';
import type { Octokit } from 'octokit';
import { octokit } from '@/server/providers/octokit.server';

type OctokitRelease = Awaited<
    ReturnType<Octokit['rest']['repos']['listReleases']>
>['data'][number];

export default async function DownloadPage() {
    let allReleases: OctokitRelease[] = [];
    try {
        const octokitReleases = await octokit.paginate(
            octokit.rest.repos.listReleases,
            {
                owner: 'chithi-dev',
                repo: 'chithi',
                per_page: 100,
            },
        );
        allReleases = octokitReleases as OctokitRelease[];
    } catch (error: unknown) {
        const isRateLimited =
            error instanceof RequestError && error.status === 403;
        return (
            <main className="relative flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
                <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-error-500/10 blur-[100px]" />

                <div className="card preset-outlined-surface-200-800 flex max-w-lg flex-col items-center space-y-6 bg-surface-100-900/30 p-10 shadow-2xl backdrop-blur-sm sm:p-14">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-500/10 text-error-500">
                        <AlertTriangle size={32} />
                    </div>

                    <h1 className="h2 font-bold tracking-tighter">
                        {isRateLimited
                            ? 'Rate Limited'
                            : 'Temporarily Unavailable'}
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
                            <span className="text-primary-500">
                                GITHUB_TOKEN
                            </span>
                            =ghp_YOUR_TOKEN
                        </div>
                    )}
                </div>
            </main>
        );
    }

    return <DownloadView releases={allReleases} />;
}
