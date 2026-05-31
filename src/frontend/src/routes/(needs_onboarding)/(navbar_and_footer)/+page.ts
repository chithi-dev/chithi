import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	definePageMetaTags({
		title: 'Landing Page',
		description: 'Check the functionalities of this chithi instance'
	});
