import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Ready to download',
	usesFileMeta: true
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
