import type { PageLoad } from './$types';
import { buildInfoPage } from '../page-loader';
import { client } from '$lib/graphql/client.js';
import { InstanceStatisticsDocument } from '$lib/graphql/generated/graphql.js';

export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { prefetch, response } = buildInfoPage(url, {
    subtitle: 'PERFORMANCE METRICS',
    title: 'Instance Statistics',
    description: 'Real-time instance metrics, storage usage, and system health.',
    ogLabel: 'PERFORMANCE METRICS'
  }, async () => {
    await client.query({ query: InstanceStatisticsDocument });
  });

  await prefetch?.();
  return response;
};
