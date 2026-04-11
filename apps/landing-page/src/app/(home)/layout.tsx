import HomeLayoutClient from './layout.client';
import { octokit } from '@/server/providers/octokit.server';

export default async function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Inline concurrent fetch of latest release and repo data
    let release = null;
    let repoData = null;

    try {
        const releasePromise = octokit.rest.repos.getLatestRelease({
            owner: 'chithi-dev',
            repo: 'chithi',
        });

        const repoPromise = octokit.rest.repos.get({
            owner: 'chithi-dev',
            repo: 'chithi',
        });

        const [releaseRes, repoRes] = await Promise.allSettled([
            releasePromise,
            repoPromise,
        ]);

        if (releaseRes.status === 'fulfilled') {
            release = releaseRes.value.data;
        } else {
            // Not fatal: repository may have no releases or request may fail
            console.warn('getLatestRelease failed', releaseRes.reason);
        }

        if (repoRes.status === 'fulfilled') {
            repoData = repoRes.value.data;
        } else {
            console.error('Failed to fetch repository data', repoRes.reason);
        }
    } catch (err) {
        console.error('Unexpected error fetching GitHub data', err);
    }

    return (
        <HomeLayoutClient release={release} repo={repoData}>
            {children}
        </HomeLayoutClient>
    );
}
