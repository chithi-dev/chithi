import { prefetch } from '#queries/config';
import type { PageLoad } from './$types';
import { markdown_to_text } from '#markdown/markdown';


export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await prefetch({ queryClient: queryClient, fetch });



};
