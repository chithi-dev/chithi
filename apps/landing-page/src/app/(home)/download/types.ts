export type GithubAsset = {
    id: string;
    name: string;
    size: number;
    downloadCount: number;
    downloadUrl: string;
};

export type GithubRelease = {
    id: string;
    name: string;
    tagName: string;
    publishedAt: string;
    author: {
        login: string;
        avatarUrl: string;
    };
    releaseAssets: {
        nodes: GithubAsset[];
    };
};
