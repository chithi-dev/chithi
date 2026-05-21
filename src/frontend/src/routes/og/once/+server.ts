import style from '#css/tailwind.css?inline';
import { read } from '$app/server';
import Geist from '$lib/assets/fonts/Geist.woff2';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import type { RequestEvent } from './$types';
import Component from './Component.svelte';

function getRequestDomain(url: URL, request: Request) {
	const forwardedHost = request.headers.get('x-forwarded-host');
	const host = forwardedHost?.split(',')[0]?.trim() ?? request.headers.get('host');
	if (host) {
		return host.replace(/:\d+$/, '');
	}

	return url.hostname;
}

export async function GET({ url, request }: RequestEvent) {
	const domain = getRequestDomain(url, request);
	const { body, head } = await render(Component, {
		props: {
			title: url.searchParams.get('title'),
			description: url.searchParams.get('description'),
			domain
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
