import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';
import type { OgConfig } from '../og-types';

const ogConfig: OgConfig = {
	label: 'Authentication',
	title: 'Welcome Back',
	description: 'Log in to your Chithi instance to manage and share encrypted files.'
};

export const GET: RequestHandler = (event) => buildOgResponse(event, ogConfig);
