import type { PageLoad } from './$types';
import { buildInfoPage } from '../page-loader';

export const load: PageLoad = async ({ url }) => {
  const { response } = buildInfoPage(url, {
    subtitle: 'SYSTEM INFORMATION',
    title: 'Chithi Instance',
    description: 'Version, source revision, and runtime metadata for this deployment.',
    ogLabel: 'SYSTEM INFORMATION'
  });

  return response;
};
