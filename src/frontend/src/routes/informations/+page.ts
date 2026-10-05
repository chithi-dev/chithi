import type { PageLoad } from './$types';
import { buildInfoPage } from './page-loader';

export const load: PageLoad = async ({ url }) => {
  const { response } = buildInfoPage(url, {
    subtitle: 'INSTANCE OVERVIEW',
    title: 'System Information',
    description:
      'Explore the infrastructure, performance metrics, and configuration of your Chithi deployment.',
    ogLabel: 'INSTANCE OVERVIEW'
  });

  return response;
};
