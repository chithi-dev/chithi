import { Api } from '#consts/backend';
import { formatFileSize } from '#functions/bytes';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	let filename = 'View File',
		size = '';
	try {
		const res = await fetch(Api.FILE_INFO(params.slug));
		if (res.ok) {
			const info = await res.json();
			filename = info.filename;
			size = formatFileSize(info.size);
		}
	} catch {
		/* ignore */
	}

	const og = new URL('/og/view', url.origin);
	og.searchParams.set('filename', filename);
	size && og.searchParams.set('size', size);

	return definePageMetaTags({
		title: `View ${filename}`,
		description: size
			? `View ${filename} (${size}) - an encrypted file shared via Chithi.`
			: `View your encrypted file with a link that automatically expires.`,
		openGraph: {
			title: `View ${filename}`,
			images: [{ url: og.toString(), width: 1200, height: 630 }]
		}
	});
};
