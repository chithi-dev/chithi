import { client } from '$lib/graphql/client.js';
import { INSTANCE_INFO_QUERY, INSTANCE_STATS_QUERY } from '$lib/graphql/queries.js';
import {
  useInstanceInfoQuery,
  useInstanceStatsQuery
} from '$lib/graphql/hooks.js';
import type { InstanceInfoData, InstanceStatsData } from '$lib/graphql/hooks.js';

export interface InstanceInformation {
  backendVersion: string;
  pythonVersion: string;
  platform: string;
}

export interface InstanceStatistics {
  totalFiles: number;
  activeFiles: number;
  expiredFiles: number;
  totalStorageUsed: number;
  totalUsers: number;
}

export const prefetchInstanceInformation = async () => {
  await client.query({ query: INSTANCE_INFO_QUERY });
};

export const prefetchInstanceStatistics = async () => {
  await client.query({ query: INSTANCE_STATS_QUERY });
};

export const useInstanceInformationQuery = () => {
  const rawInfo = useInstanceInfoQuery();

  const info = $derived({
    data: rawInfo.data ? mapInstanceInfo(rawInfo.data.instanceInformation) : undefined,
    isLoading: rawInfo.fetching,
    error: rawInfo.error ? new Error(rawInfo.error) : null
  });

  return { info };
};

export const useInstanceStatisticsQuery = () => {
  const rawStats = useInstanceStatsQuery();

  const stats = $derived({
    data: rawStats.data ? mapInstanceStats(rawStats.data.instanceStatistics) : undefined,
    isLoading: rawStats.fetching,
    error: rawStats.error ? new Error(rawStats.error) : null
  });

  return { stats };
};

function mapInstanceInfo(
  data: InstanceInfoData['instanceInformation']
): InstanceInformation {
  return {
    backendVersion: data.backendVersion,
    pythonVersion: data.pythonVersion,
    platform: data.platform
  };
}

function mapInstanceStats(
  data: InstanceStatsData['instanceStatistics']
): InstanceStatistics {
  return {
    totalFiles: data.totalFiles,
    activeFiles: data.activeFiles,
    expiredFiles: data.expiredFiles,
    totalStorageUsed: data.totalStorageUsed,
    totalUsers: data.totalUsers
  };
}
