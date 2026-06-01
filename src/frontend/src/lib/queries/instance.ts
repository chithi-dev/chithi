import { Api } from '#consts/backend';
import { makeFetcher, makeQuery } from './fetch-utils';

const STALE = 5 * 60 * 1000;

// Instance information
const infoFetcher = makeFetcher(Api.INSTANCE, 'instance information');
const info = makeQuery(infoFetcher, 'instance-information', { staleTime: STALE });
export const prefetchInstanceInformation = info.prefetch;
export const useInstanceInformationQuery = info.useQuery;

// Instance statistics
const statsFetcher = makeFetcher(Api.INSTANCE_STATISTICS, 'instance statistics');
const stats = makeQuery(statsFetcher, 'instance-statistics', { staleTime: STALE });
export const prefetchInstanceStatistics = stats.prefetch;
export const useInstanceStatisticsQuery = stats.useQuery;
