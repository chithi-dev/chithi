import HomeLayoutClient from './layout.client';
import { octokit } from '@/server/providers/octokit.server';

export default async function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Inline concurrent fetch of latest release and repo data
    let repoData = null;

    try {
        const data = await octokit.graphql<{
            repository: {
                stargazerCount: number;
                forkCount: number;
                latestRelease: {
                    tagName: string;
                } | null;
            };
        }>(`
            query {
                repository(owner: "chithi-dev", name: "chithi") {
                    stargazerCount
                    forkCount
                    latestRelease {
                        tagName
                    }
                }
            }
        `);

        if (data?.repository) {
            repoData = data.repository;
        }
    } catch (err) {
        console.error('Unexpected error fetching GitHub data', err);
    }

    return <HomeLayoutClient repo={repoData}>{children}</HomeLayoutClient>;
}
