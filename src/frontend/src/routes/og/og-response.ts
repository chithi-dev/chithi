import style from '#css/tailwind.css?inline';
import { read } from '$app/server';
import Geist from '$lib/assets/fonts/Geist.woff2';
import type { RequestEvent } from '@sveltejs/kit';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import Component from './Component.svelte';
import { buildOgDisplay } from './og-display';
import { OgDirection, OgSecurity } from './og-enums';
import type { OgConfig } from './og-types';

const RTL_CHARACTERS = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

function parseForwardedHost(forwarded: string | null) {
	if (!forwarded) return null;

	const match = forwarded.match(/host=([^;]+)/i);
	if (!match) return null;

	return match[1]?.trim().replace(/^"|"$/g, '');
}

function parseForwardedProto(forwarded: string | null) {
	if (!forwarded) return null;

	const match = forwarded.match(/proto=([^;]+)/i);
	if (!match) return null;

	return match[1]?.trim().replace(/^"|"$/g, '').toLowerCase();
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
	if (URL.canParse(value)) {
		return normalizeHost(new URL(value).host);
	}
	return normalizeHost(value);
}

function parseProtocolFromHeader(value: string | null) {
	if (!value) return '';
	if (URL.canParse(value)) {
		return new URL(value).protocol.replace(':', '').toLowerCase();
	}
	return '';
}

function parseFileCount(value: string | null) {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return parsed;
}

function getRequestProtocol(url: URL, request: Request, domainOverride: string | null) {
	const overrideProtocol = parseProtocolFromHeader(domainOverride);
	if (overrideProtocol) return overrideProtocol;

	const forwardedProto = parseForwardedProto(request.headers.get('forwarded'));
	if (forwardedProto) return forwardedProto;

	const forwardedHeader = request.headers.get('x-forwarded-proto');
	if (forwardedHeader) {
		const proto = forwardedHeader.split(',')[0]?.trim().toLowerCase();
		if (proto) return proto;
	}

	const originProtocol = parseProtocolFromHeader(request.headers.get('origin'));
	if (originProtocol) return originProtocol;

	return url.protocol.replace(':', '').toLowerCase();
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

export async function buildOgResponse(event: RequestEvent, config: OgConfig) {
	const { url, request } = event;
	const domainOverride = url.searchParams.get('domain') ?? null;
	const domain = domainOverride?.trim() || getRequestDomain(url, request);
	const protocol = getRequestProtocol(url, request, domainOverride);
	const fileCount = parseFileCount(url.searchParams.get('files'));
	const displayDomain = (() => {
		const trimmed = domain.trim();
		if (!trimmed) return '';
		if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '');
		const scheme = protocol === 'http' ? 'http' : 'https';
		return `${scheme}://${trimmed.replace(/\/$/, '')}`;
	})();
	const domainDirection = RTL_CHARACTERS.test(domain) ? OgDirection.Rtl : OgDirection.Ltr;
	const domainSecurity = protocol === 'https' ? OgSecurity.Secure : OgSecurity.Insecure;
	const display = buildOgDisplay(config, {
		label: url.searchParams.get('label'),
		title: url.searchParams.get('title'),
		description: url.searchParams.get('description'),
		filename: url.searchParams.get('filename'),
		size: url.searchParams.get('size'),
		fileCount
	});

	const { body, head } = await render(Component, {
		props: {
			label: display.label,
			title: display.title,
			subtitle: display.subtitle,
			displayDomain,
			domainDirection,
			domainSecurity,
			footerTags: display.footerTags
		}
	});
	const height = 630;
	const width = 1200;
	const wantsHtml = url.searchParams.get('html')?.toLowerCase() === 'true';
	if (wantsHtml) {
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	${head}
	<style>${style}</style>
</head>
<body style="height:${height}px; width:${width}px;">
	${body}
</body>
</html>
`;
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
