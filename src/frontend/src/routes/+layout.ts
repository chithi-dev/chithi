import { browser } from '$app/environment';
import image from '$lib/assets/opengraph.png?url';
import { QueryClient } from '@tanstack/svelte-query';
import { defineBaseMetaTags } from 'svelte-meta-tags';
import type { LayoutLoad } from './$types';
export const trailingSlash = 'always';

export const load: LayoutLoad = async ({ data, url }) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser
			}
		}
	});
	const baseTags = defineBaseMetaTags({
		title: 'Chithi',
		titleTemplate: '%s | Chithi',
		description:
			'Encrypt and send files with a link that automatically expires to ensure your important documents don’t stay online forever.',
		canonical: new URL(url.pathname, url.origin).href, // creates a cleaned up URL (without hashes or query params) from your current URL
		openGraph: {
			type: 'website',
			url: new URL(url.pathname, url.origin).href,
			locale: 'en_US',
			title: 'Chithi',
			description:
				'Encrypt and send files with a link that automatically expires to ensure your important documents don’t stay online forever.',
			siteName: 'Chithi Dev',
			images: [
				{
					url: image,
					width: 800,
					height: 600,
					alt: 'Chithi | Encrypted File Sharing'
				}
			]
		}
	});

	return { queryClient, ...baseTags, ...data };
};
