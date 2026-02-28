import { definePageMetaTags } from 'svelte-meta-tags';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v3';
import type { PageLoad } from './$types';

const schema = z.object({
	email: z.string().min(1, 'Email or Username is required'),
	password: z.string().min(1, 'Password is required')
});

export const load: PageLoad = async () => {
	const pageTags = definePageMetaTags({
		title: 'Login',
		description: 'Login to your chithi instance.',
		openGraph: {
			title: 'Login',
			description: 'Login to your chithi instance.'
		}
	});
	const form = await superValidate(zod(schema));

	return { form, ...pageTags };
};
