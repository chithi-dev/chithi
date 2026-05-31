import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const og = new URL('/og/info', url.origin);
	og.searchParams.set('label', 'SYSTEM INFORMATION');
	og.searchParams.set('title', 'Chithi Instance');
	const header = {
		subtitle: og.searchParams.get('label')!,
		title: og.searchParams.get('title')!,
		description: 'Version, source revision, and runtime metadata for this deployment.'
	};
	return {
		...definePageMetaTags({
			title: 'Information',
			description: 'Get information about this chithi instance.',
			openGraph: {
				title: 'Information',
				images: [{ url: og.toString(), width: 1200, height: 630 }]
			}
		}),
		header
	};
};
