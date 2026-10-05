import type { PageLoad } from './$types';
import { buildInfoPage } from '../page-loader';

export const load: PageLoad = async ({ fetch, parent, url }) => {
  const { response } = buildInfoPage(url, {
    subtitle: 'PERFORMANCE METRICS',
    title: 'Instance Statistics',
    description: 'Real-time instance metrics, storage usage, and system health.',
    ogLabel: 'PERFORMANCE METRICS'
  });

  return response;
};
