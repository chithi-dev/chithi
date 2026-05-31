import { definePageMetaTags } from 'svelte-meta-tags';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageLoad } from './$types';
import { schema } from './schema';

export const load: PageLoad = async ({ url }) => {
	const og = new URL('/og/login', url.origin);
	const form = await superValidate(zod4(schema));
	return {
		form,
		...definePageMetaTags({
			title: 'Login',
			description: 'Login to your chithi instance.',
			openGraph: { title: 'Login', images: [{ url: og.toString(), width: 1200, height: 630 }] }
		})
	};
};
