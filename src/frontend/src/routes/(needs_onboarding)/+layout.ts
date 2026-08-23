import { client } from '$lib/graphql/client.js';
import { OnboardingDocument } from '$lib/graphql/generated/graphql.js';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await client.query({ query: OnboardingDocument });
};
