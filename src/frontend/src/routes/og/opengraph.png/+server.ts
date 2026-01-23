import { ImageResponse } from '@ethercorps/sveltekit-og';
import type { RequestHandler } from '@sveltejs/kit';
import OpenGraphComponent from './OpenGraph.svelte';
import { CONFIG_URL } from '$lib/consts/backend';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';

function markdownToText(md: string): string {
	const tree = unified().use(remarkParse).parse(md) as Root;

	let result = '';

	visit(tree, 'text', (node: Text) => {
		result += node.value;
	});

	// Replace multiple consecutive newlines with single newline
	return result.replace(/\n\s*\n/g, '\n').trim();
}

export const GET: RequestHandler = async () => {
	const res = await fetch(CONFIG_URL, { method: 'GET' });
	if (!res.ok) throw new Error('Failed to fetch config data for OG image');

	const data = await res.json();

	const description = markdownToText(data.site_description ?? '');
	console.log(data);
	return new ImageResponse(
		OpenGraphComponent,
		{
			width: 1200,
			height: 630
		},
		{
			description: description
		}
	);
};
