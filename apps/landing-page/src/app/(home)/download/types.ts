// Define minimal types for the GitHub Release and Assets
export type Asset = {
    id: number;
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
};

export type Release = {
    id: number;
    name: string;
    tagName: string;
    published_at: string;
    author: { login: string; avatar_url: string };
    assets: Asset[];
};
