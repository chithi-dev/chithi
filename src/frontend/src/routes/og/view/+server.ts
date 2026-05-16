import style from '#css/tailwind.css?inline';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import { read } from '$app/server';
import Geist from '$lib/assets/fonts/Geist.woff2';
import type { RequestEvent } from './$types';
import Component from './Component.svelte';

export async function GET({ url }: RequestEvent) {
	const { body, head } = await render(Component, {
		props: {
			filename: url.searchParams.get('filename'),
			size: url.searchParams.get('size')
		}
	});

	return new ImageResponse(`${head}${body}`, {
		width: 1200,
		height: 630,
		stylesheets: [style],
		fonts: [
			{
				name: 'Geist',
				data: () => read(Geist).arrayBuffer()
			}
		]
	});
}
