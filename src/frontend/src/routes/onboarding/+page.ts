import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () =>
	definePageMetaTags({
		title: 'Onboarding',
		description: 'Onboarding for your chithi instance.'
	});
