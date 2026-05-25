import style from '#css/tailwind.css?inline';
import { read } from '$app/server';
import Geist from '$lib/assets/fonts/Geist.woff2';
import type { RequestEvent } from '@sveltejs/kit';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import Component from './Component.svelte';
import type { OgKind } from './og-config';

const RTL_CHARACTERS = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

function parseForwardedHost(forwarded: string | null) {
	if (!forwarded) return null;

	const match = forwarded.match(/host=([^;]+)/i);
	if (!match) return null;

	return match[1]?.trim().replace(/^"|"$/g, '');
}

function normalizeHost(rawHost: string) {
	const cleaned = rawHost.split(',')[0]?.trim();
	if (!cleaned) return '';

	let host = cleaned.replace(/^"|"$/g, '');
	if (host.includes('://')) {
		try {
			host = new URL(host).host;
		} catch {
			return '';
		}
	}

	if (host.startsWith('[')) {
		return host;
	}

	const [hostname, port] = host.split(':');
	if (!port) return hostname;

	const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

	if (isLocal) return `${hostname}:${port}`;
	if (port === '80' || port === '443') return hostname;

	return `${hostname}:${port}`;
}

function parseHostFromHeader(value: string | null) {
	if (!value) return '';
	try {
		return normalizeHost(new URL(value).host);
	} catch {
		return normalizeHost(value);
	}
}

function getRequestDomain(url: URL, request: Request) {
	const forwardedHost = parseForwardedHost(request.headers.get('forwarded'));
	const hostHeader =
		forwardedHost ?? request.headers.get('x-forwarded-host') ?? request.headers.get('host');
	const normalized = hostHeader ? normalizeHost(hostHeader) : '';
	if (normalized) return normalized;

	const originHost = parseHostFromHeader(request.headers.get('origin'));
	if (originHost) return originHost;

	const refererHost = parseHostFromHeader(request.headers.get('referer'));
	if (refererHost) return refererHost;

	return url.host || url.hostname;
}

export async function buildOgResponse(event: RequestEvent, kind: OgKind) {
	const { url, request } = event;
	const domainOverride = url.searchParams.get('domain');
	const domain = domainOverride?.trim() || getRequestDomain(url, request);
	const domainDirection = RTL_CHARACTERS.test(domain) ? 'rtl' : 'ltr';

	const { body, head } = await render(Component, {
		props: {
			kind,
			label: url.searchParams.get('label'),
			title: url.searchParams.get('title'),
			description: url.searchParams.get('description'),
			filename: url.searchParams.get('filename'),
			size: url.searchParams.get('size'),
			domain,
			domainDirection
		}
	});
	const height = 630;
	const width = 1200;
	const wantsHtml = url.searchParams.get('html');
	if (wantsHtml?.toLowerCase() === 'true') {
		const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		${head}
		<style>${style}</style>
		<style>html, body { margin: 0; padding: 0; }</style>
	</head>
	<body style="height:${height}px; width:${width}px;">
		${body}
	</body>
</html>`;

		return new Response(html, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8'
			}
		});
	}

	return new ImageResponse(`${head}${body}`, {
		width: width,
		height: height,
		stylesheets: [style],
		fonts: [
			{
				name: 'Geist Variable',
				data: () => read(Geist).arrayBuffer()
			}
		]
	});
}
