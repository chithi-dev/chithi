import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const baseOgConfig: OgConfig = {
	label: 'Private by design',
	title: 'Chithi',
	description: 'Encrypted file sharing with end-to-end privacy and auto-expiring links',
	footerTags: ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge transfer']
};

export const GET: RequestHandler = (event) => buildOgResponse(event, baseOgConfig);
