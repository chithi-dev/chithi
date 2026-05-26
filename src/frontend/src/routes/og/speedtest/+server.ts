import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Performance',
	title: 'Network Speedtest',
	description: 'Test your connection speed to the Chithi server for optimal transfers.'
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
