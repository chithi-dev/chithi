import { browser } from '$app/environment';
import { QueryClient } from '@tanstack/svelte-query';
import { defineBaseMetaTags } from 'svelte-meta-tags';

export const load = async ({ url }) => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser
			}
		}
	});

	const baseTags = defineBaseMetaTags({
		title: 'Default',
		titleTemplate: '%s | Chithi',
		description:
			'An encrypted end-to-end file sharing service with a zero trust server architecture',
		canonical: new URL(url.pathname, url.origin).href, // creates a cleaned up URL (without hashes or query params) from your current URL
		openGraph: {
			type: 'website',
			url: new URL(url.pathname, url.origin).href,
			locale: 'en_US'
		}
	});

	return { queryClient, ...baseTags };
};
