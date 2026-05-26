import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Information',
	title: 'Chithi Instance',
	description: 'System information, statistics, and metadata for this instance.',
	labelFromQuery: true
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
