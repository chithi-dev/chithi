import { definePageMetaTags } from 'svelte-meta-tags';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageLoad } from './$types';
import { schema } from './schema';

export const load: PageLoad = async ({ url }) => {
	const ogUrl = new URL('/og/login', url.origin);

	const pageTags = definePageMetaTags({
		title: 'Login',
		description: 'Login to your chithi instance.',
		openGraph: {
			title: 'Login',
			description: 'Login to your chithi instance.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Login'
				}
			]
		}
	});
	const form = await superValidate(zod4(schema));

	return { form, ...pageTags };
};
