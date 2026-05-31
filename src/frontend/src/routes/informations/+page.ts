import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const og = new URL('/og/info', url.origin);
	['label', 'title', 'description'].forEach((k) =>
		og.searchParams.set(
			k,
			{
				label: 'INSTANCE OVERVIEW',
				title: 'System Information',
				description:
					'Explore the infrastructure, performance metrics, and configuration of your Chithi deployment.'
			}[k]!
		)
	);
	return {
		...definePageMetaTags({
			title: 'Instance Information',
			description:
				'Overview of this Chithi instance, including backend, frontend, and system statistics.',
			openGraph: {
				title: 'Instance Information',
				images: [{ url: og.toString(), width: 1200, height: 630 }]
			}
		}),
		header: {
			subtitle: 'INSTANCE OVERVIEW',
			title: 'System Information',
			description: og.searchParams.get('description')!
		}
	};
};
