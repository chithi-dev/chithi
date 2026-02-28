import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Download File',
		description: 'Download your encrypted file with a link that automatically expires.',
		openGraph: {
			title: 'Download File',
			description: 'Download your encrypted file with a link that automatically expires.'
		}
	});

	return { ...pageTags };
};
