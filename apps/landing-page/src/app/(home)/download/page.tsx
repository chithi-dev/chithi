import { RequestError } from 'octokit';
import { octokit } from '$/providers/octokit.server';
import DownloadView from './page.client';
import type { GithubRelease } from './types';

export default async function DownloadPage() {
    let allReleases: GithubRelease[] = [];
    try {
        const data = await octokit.graphql<{
            repository: {
                releases: {
                    nodes: GithubRelease[];
                };
            };
        }>(`
            query {
                repository(owner: "chithi-dev", name: "chithi") {
                    releases(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
                        nodes {
                            id
                            name
                            tagName
                            publishedAt
                            author {
                                login
                                avatarUrl
                            }
                            releaseAssets(first: 100) {
                                nodes {
                                    id
                                    name
                                    size
                                    downloadCount
                                    downloadUrl
                                }
                            }
                        }
                    }
                }
            }
        `);

        if (data?.repository?.releases?.nodes) {
            allReleases = data.repository.releases.nodes;
        }
    } catch (error: unknown) {
        const isRateLimited =
            error instanceof RequestError && error.status === 403;
        const err = new Error(
            isRateLimited ? 'RATE_LIMIT' : 'RELEASES_FETCH_FAILED',
        );
        (err as Error & { cause?: unknown }).cause = error;
        throw err;
    }

    return <DownloadView releases={allReleases} />;
}
