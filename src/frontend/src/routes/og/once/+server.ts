import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Burn After Reading',
	title: 'One-time View',
	description: 'View your encrypted file once. The link will expire immediately after.'
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
