import style from '#css/tailwind.css?inline';
import { read } from '$app/server';
import Geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2';
import type { RequestEvent } from '@sveltejs/kit';
import { render } from 'svelte/server';
import ImageResponse from 'takumi-js/response';
import Component from './Component.svelte';
import { buildOgDisplay } from './og-display';
import { OgDirection, OgSecurity } from './og-enums';
import type { OgConfig } from './og-types';

const RTL = /[֑-߿יִ-﷽ﹰ-ﻼ]/;
const parseFH = (v: string | null) =>
	v
		?.match(/host=([^;]+)/i)?.[1]
		?.trim()
		.replace(/^"|"$/g, '');
const parseFP = (v: string | null) =>
	v
		?.match(/proto=([^;]+)/i)?.[1]
		?.trim()
		.replace(/^"|"$/g, '')
		.toLowerCase();
const norm = (h: string) => {
	let c = h.split(',')[0]?.trim().replace(/^"|"$/g, '');
	if (!c) return '';
	if (c.includes('://')) {
		try {
			c = new URL(c).host;
		} catch {
			return '';
		}
	}
	if (c.startsWith('[')) return c;
	const [hn, p] = c.split(':');
	if (!p) return hn;
	return ['localhost', '127.0.0.1', '0.0.0.0'].includes(hn) || (p !== '80' && p !== '443')
		? `${hn}:${p}`
		: hn;
};
const hFrom = (v: string | null) => (v ? (URL.canParse(v) ? norm(new URL(v).host) : norm(v)) : '');
const pFrom = (v: string | null) =>
	v ? (URL.canParse(v) ? new URL(v).protocol.replace(':', '') : '') : '';

export async function buildOgResponse(event: RequestEvent, config: OgConfig) {
	const { url, request: req } = event;
	const domOv = url.searchParams.get('domain') ?? null;
	const rawHost =
		parseFH(req.headers.get('forwarded')) ??
		req.headers.get('x-forwarded-host') ??
		req.headers.get('host');
	const domain =
		domOv?.trim() ||
		(rawHost ? norm(rawHost) : '') ||
		hFrom(req.headers.get('origin')) ||
		hFrom(req.headers.get('referer')) ||
		url.host ||
		url.hostname;
	const proto =
		pFrom(domOv) ||
		parseFP(req.headers.get('forwarded')) ||
		req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
		pFrom(req.headers.get('origin')) ||
		url.protocol.replace(':', '');
	const d = (domain as string).trim();
	const displayDomain = d
		? /^https?:\/\//i.test(d)
			? d.replace(/\/$/, '')
			: `${proto === 'http' ? 'http' : 'https'}://${d.replace(/\/$/, '')}`
		: '';
	const fc = (v: string | null) => {
		const n = Number.parseInt(v!, 10);
		return n > 0 ? n : null;
	};
	const display = buildOgDisplay(config, {
		label: url.searchParams.get('label'),
		title: url.searchParams.get('title'),
		description: url.searchParams.get('description'),
		filename: url.searchParams.get('filename'),
		size: url.searchParams.get('size'),
		fileCount: fc(url.searchParams.get('files'))
	});
	const { body, head } = await render(Component, {
		props: {
			...display,
			displayDomain,
			domainDirection: RTL.test(domain) ? OgDirection.Rtl : OgDirection.Ltr,
			domainSecurity: proto === 'https' ? OgSecurity.Secure : OgSecurity.Insecure
		}
	});
	if (url.searchParams.get('html')?.toLowerCase() === 'true') {
		return new Response(
			`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${head}<style>${style}</style></head><body style="height:630px;width:1200px;">${body}</body></html>`,
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}
	return new ImageResponse(`${head}${body}`, {
		width: 1200,
		height: 630,
		stylesheets: [style],
		fonts: [{ name: 'Geist Variable', data: () => read(Geist).arrayBuffer() }]
	});
}
