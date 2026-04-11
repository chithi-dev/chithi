import HomeLayoutClient from './layout.client';
import { octokit } from '@/lib/octokit.server';

export default async function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Fetch latest release to show the tag version in the navbar
    let release = null;
    try {
        const { data } = await octokit.rest.repos.getLatestRelease({
            owner: 'chithi-dev',
            repo: 'chithi',
        });
        release = data;
    } catch (error) {
        console.error('Failed to fetch latest release', error);
    }

    return <HomeLayoutClient release={release}>{children}</HomeLayoutClient>;
}
