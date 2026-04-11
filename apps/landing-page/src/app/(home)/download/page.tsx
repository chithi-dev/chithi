import { AlertTriangle } from "lucide-react";
import DownloadView from "./page.client";

// Define minimal types for the GitHub Release and Assets
type Asset = {
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

export default async function DownloadPage() {
	let allReleases: Release[] = [];
	let page = 1;
	let hasMore = true;

	while (hasMore) {
		const response = await fetch(
			`https://api.github.com/repos/chithi-dev/chithi/releases?per_page=100&page=${page}`,
			{
				headers: {
					...(process.env.GITHUB_TOKEN && {
						Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
					}),
				},
				next: { revalidate: 120 },
			},
		);

		if (!response.ok) {
			if (page === 1) {
				const isRateLimited = response.status === 403;
				return (
					<main className="relative flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
						<div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-error-500/10 blur-[100px]" />

						<div className="card preset-outlined-surface-200-800 flex max-w-lg flex-col items-center space-y-6 bg-surface-100-900/30 p-10 shadow-2xl backdrop-blur-sm sm:p-14">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-500/10 text-error-500">
								<AlertTriangle size={32} />
							</div>

							<h1 className="h2 font-bold tracking-tighter">
								{isRateLimited ? "Rate Limited" : "Temporarily Unavailable"}
							</h1>

							<p className="text-lg text-surface-600-400 leading-relaxed">
								{isRateLimited
									? "GitHub API rate limit exceeded. Please try again later or configure a token."
									: "Failed to fetch the latest Chithi CLI releases from GitHub. Please try again in a moment."}
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
						</div>
					</main>
				);
			}
			break;
		}

		const data = await response.json();
		if (data.length > 0) {
			allReleases = allReleases.concat(data);
			if (data.length < 100) {
				hasMore = false;
			} else {
				page++;
			}
		} else {
			hasMore = false;
		}
	}

	return <DownloadView releases={allReleases} />;
}
