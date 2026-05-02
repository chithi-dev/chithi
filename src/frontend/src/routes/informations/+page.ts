import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const pageTags = definePageMetaTags({
		title: 'Instance Information',
		description: 'Overview of this Chithi instance, including backend, frontend, and system statistics.',
		openGraph: {
			title: 'Instance Information',
			description: 'Overview of this Chithi instance, including backend, frontend, and system statistics.'
		}
	});

	return {
		...pageTags,
		header: {
			subtitle: 'INSTANCE OVERVIEW',
			title: 'System Information',
			description: 'Explore the infrastructure, performance metrics, and configuration of your Chithi deployment.'
		}
	};
};
