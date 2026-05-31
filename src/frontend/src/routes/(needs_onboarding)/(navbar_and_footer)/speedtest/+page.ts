import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) =>
	definePageMetaTags({
		title: 'Speedtest',
		description: 'Test your internet connection speed with chithi server',
		openGraph: {
			title: 'Speedtest',
			images: [{ url: new URL('/og/speedtest', url.origin).toString(), width: 1200, height: 630 }]
		}
	});
