import { Api } from '#consts/backend';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch(Api.INSTANCE);
	const info = await res.json();

	const pageTags = definePageMetaTags({
		title: 'Backend Information',
		description: 'Detailed information about the Chithi backend instance.',
		openGraph: {
			title: 'Backend Information',
			description: 'Detailed information about the Chithi backend instance.'
		}
	});

	return {
		info,
		...pageTags
	};
};
