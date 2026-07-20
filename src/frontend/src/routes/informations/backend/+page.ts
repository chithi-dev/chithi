import { prefetchInstanceInformation } from '$lib/queries/instance';
import type { PageLoad } from './$types';
import { buildInfoPage } from '../page-loader';

export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { prefetch, response } = buildInfoPage(url, {
    subtitle: 'BACKEND INFRASTRUCTURE',
    title: 'Chithi Backend',
    description: 'Runtime environment, service versions, and architectural metadata.',
    ogLabel: 'BACKEND INFRASTRUCTURE'
  }, async () => {
    const { queryClient } = await parent();
    await prefetchInstanceInformation();
  });

  await prefetch?.();
  return response;
};
