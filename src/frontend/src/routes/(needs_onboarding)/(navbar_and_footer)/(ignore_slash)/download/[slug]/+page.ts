import { Api } from '#consts/backend';
import { formatFileSize } from '#functions/bytes';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	let filename = 'Download File',
		size = '',
		count = 0;
	try {
		const res = await fetch(Api.FILE_INFO(params.slug));
		if (res.ok) {
			const info = await res.json();
			filename = info.filename;
			size = formatFileSize(info.size);
			count = info.number_of_files ?? 0;
		}
	} catch {
		/* ignore */
	}

	const details = [size, count && `${count} file${count > 1 ? 's' : ''}`].filter(Boolean);
	const og = new URL('/og/download', url.origin);
	og.searchParams.set('filename', filename);
	size && og.searchParams.set('size', size);
	count && og.searchParams.set('files', count.toString());

	return definePageMetaTags({
		title: `Download ${filename}`,
		description: `Download ${filename}${details.length ? ` (${details.join(', ')})` : ''} - an encrypted file shared via Chithi.`,
		openGraph: {
			title: `Download ${filename}`,
			images: [{ url: og.toString(), width: 1200, height: 630 }]
		}
	});
};
