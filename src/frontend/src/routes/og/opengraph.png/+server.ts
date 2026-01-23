import { ImageResponse } from '@ethercorps/sveltekit-og';
import type { RequestHandler } from '@sveltejs/kit';
import OpenGraphComponent from './OpenGraph.svelte';
import { CONFIG_URL } from '$lib/consts/backend';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';
import { formatFileSize } from '$lib/functions/bytes';

function markdownToText(md: string): string {
	const tree = unified().use(remarkParse).parse(md) as Root;

	let result = '';

	visit(tree, 'text', (node: Text) => {
		result += node.value;
	});

	return result.replace(/\n\s*\n/g, '\n').trim();
}
function checkWordOverflow(
	input: string,
	limit = 150
): {
	overflown: boolean;
	text: string;
} {
	const words = input.trim().split(/\s+/);

	if (words.length > limit) {
		return {
			overflown: true,
			text: words.slice(0, limit).join(' ')
		};
	}

	return {
		overflown: false,
		text: input
	};
}
export const GET: RequestHandler = async () => {
	const res = await fetch(CONFIG_URL, { method: 'GET' });
	if (!res.ok) throw new Error('Failed to fetch config data for OG image');

	const data = await res.json();

	const maxFileSize = formatFileSize(data?.max_file_size_limit ?? 0);
	const { overflown, text: description } = checkWordOverflow(
		markdownToText(data.site_description ?? ''),
		150
	);

	return new ImageResponse(
		OpenGraphComponent,
		{
			width: 1200,
			height: 630
		},
		{
			description: description,
			maxFileSize: maxFileSize,
			isOverflown: overflown
		}
	);
};
