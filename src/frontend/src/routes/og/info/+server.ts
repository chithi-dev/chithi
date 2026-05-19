import style from '#css/tailwind.css?inline';
import { read } from '$app/server';
import Geist from '$lib/assets/fonts/Geist.woff2';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import type { RequestEvent } from './$types';
import Component from './Component.svelte';

export async function GET({ url }: RequestEvent) {
	const { body, head } = await render(Component, {
		props: {
			label: url.searchParams.get('label'),
			title: url.searchParams.get('title'),
			description: url.searchParams.get('description')
		}
	});

	return new ImageResponse(`${head}${body}`, {
		width: 1200,
		height: 630,
		stylesheets: [style],
		fonts: [
			{
				name: 'Geist Variable',
				data: () => read(Geist).arrayBuffer()
			}
		]
	});
}
