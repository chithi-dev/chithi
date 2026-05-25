import { Api } from '#consts/backend';
import { formatFileSize } from '#functions/bytes';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	let filename = 'Download File';
	let description = 'Download your encrypted file with a link that automatically expires.';
	let fileSizeStr = '';
	let fileCount = 0;

	try {
		const res = await fetch(Api.FILE_INFO(params.slug));
		if (res.ok) {
			const info = await res.json();
			filename = info.filename;
			fileSizeStr = formatFileSize(info.size);
			fileCount = info.number_of_files ?? 0;
			const details: string[] = [];
			if (fileSizeStr) details.push(fileSizeStr);
			if (fileCount) {
				details.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
			}
			description = details.length
				? `Download ${filename} (${details.join(', ')}) - an encrypted file shared via Chithi.`
				: `Download ${filename} - an encrypted file shared via Chithi.`;
		}
	} catch (e) {
		console.error('Failed to fetch file info for meta tags', e);
	}

	const ogUrl = new URL('/og/download', url.origin);
	ogUrl.searchParams.set('filename', filename);
	if (fileSizeStr) {
		ogUrl.searchParams.set('size', fileSizeStr);
	}
	if (fileCount) {
		ogUrl.searchParams.set('files', fileCount.toString());
	}

	const pageTags = definePageMetaTags({
		title: `Download ${filename}`,
		description,
		openGraph: {
			title: `Download ${filename}`,
			description,
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: `Download ${filename}`
				}
			]
		}
	});

	return { ...pageTags };
};
