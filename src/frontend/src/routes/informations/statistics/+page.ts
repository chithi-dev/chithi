import { prefetchInstanceStatistics } from '$lib/queries/instance';
import type { PageLoad } from './$types';
import { buildInfoPage } from '../page-loader';

export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { prefetch, response } = buildInfoPage(url, {
    subtitle: 'PERFORMANCE METRICS',
    title: 'Instance Statistics',
    description: 'Real-time instance metrics, storage usage, and system health.',
    ogLabel: 'PERFORMANCE METRICS'
  }, async () => {
    const { queryClient } = await parent();
    await prefetchInstanceStatistics({ queryClient, fetch });
  });

  await prefetch?.();
  return response;
};
