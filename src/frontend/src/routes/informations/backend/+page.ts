import { buildInfoPage } from '../page-loader';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const { response } = buildInfoPage(url, {
		subtitle: 'BACKEND INFRASTRUCTURE',
		title: 'Chithi Backend',
		description: 'Runtime environment, service versions, and architectural metadata.',
		ogLabel: 'BACKEND INFRASTRUCTURE'
	});

	return response;
};
