import { definePageMetaTags } from 'svelte-meta-tags';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageLoad } from './$types';
import { schema } from './schema';

export const load: PageLoad = async ({ url }) => {
	const ogUrl = new URL('/og', url.origin);
	ogUrl.searchParams.set('type', 'login');
	ogUrl.searchParams.set('title', 'Welcome Back');
	ogUrl.searchParams.set(
		'description',
		'Log in to your Chithi instance to manage and share encrypted files.'
	);

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
