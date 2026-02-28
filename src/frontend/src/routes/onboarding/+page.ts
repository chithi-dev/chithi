import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Onboarding',
		description: 'Onboarding for your chithi instance.',
		openGraph: {
			title: 'Onboarding',
			description: 'Onboarding for your chithi instance.'
		}
	});

	return { ...pageTags };
};
