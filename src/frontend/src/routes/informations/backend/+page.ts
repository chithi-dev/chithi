import { buildInfoPage } from '../page-loader';
import type { PageLoad } from './$types';
import { client } from '$lib/graphql/client.js';
import { InstanceInformationDocument } from '$lib/graphql/generated/graphql.js';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const { prefetch, response } = buildInfoPage(
		url,
		{
			subtitle: 'BACKEND INFRASTRUCTURE',
			title: 'Chithi Backend',
			description: 'Runtime environment, service versions, and architectural metadata.',
			ogLabel: 'BACKEND INFRASTRUCTURE'
		},
		async () => {
			await client.query({ query: InstanceInformationDocument });
		}
	);

	await prefetch?.();
	return response;
};
