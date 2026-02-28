import { definePageMetaTags } from 'svelte-meta-tags';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageLoad } from './$types';
import { schema } from './schema';

export const load: PageLoad = async () => {
	const pageTags = definePageMetaTags({
		title: 'Login',
		description: 'Login to your chithi instance.',
		openGraph: {
			title: 'Login',
			description: 'Login to your chithi instance.'
		}
	});
	const form = await superValidate(zod4(schema));

	return { form, ...pageTags };
};
