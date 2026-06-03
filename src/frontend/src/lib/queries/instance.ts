import { Api } from '#consts/backend';
import { makeFetcher, makeQuery } from './fetch-utils';

const STALE = 5 * 60 * 1000;

export interface InstanceInformation {
	version: string;
	is_release: boolean;
	commit: string;
	python_version: string;
	fastapi_version: string;
	redis_version: string;
	postgres_version: string;
}

export interface InstanceStatistics {
	total_bytes: number;
	total_files: number;
	total_downloads: number;
	active_urls: number;
	active_rooms: number;
	expiring_soon: number;
	latest_expiry: number | null;
	oldest_file: number;
	newest_file: number;
}

// Instance information
const infoFetcher = makeFetcher<InstanceInformation>(Api.INSTANCE, 'instance information');
const info = makeQuery(infoFetcher, 'instance-information', { staleTime: STALE });
export const prefetchInstanceInformation = info.prefetch;
export const useInstanceInformationQuery = info.useQuery;

// Instance statistics
const statsFetcher = makeFetcher<InstanceStatistics>(Api.INSTANCE_STATISTICS, 'instance statistics');
const stats = makeQuery(statsFetcher, 'instance-statistics', { staleTime: STALE });
export const prefetchInstanceStatistics = stats.prefetch;
export const useInstanceStatisticsQuery = stats.useQuery;
