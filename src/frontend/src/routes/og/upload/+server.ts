import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Share Securely',
	title: 'Upload Files',
	description: 'Securely upload and share encrypted files with auto-expiring links.'
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
