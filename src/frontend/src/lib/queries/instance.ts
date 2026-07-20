import { client } from '#graphql/client';
import { INSTANCE_INFO_QUERY, INSTANCE_STATS_QUERY } from '#graphql/queries';
import {
  useInstanceInfoQuery,
  useInstanceStatsQuery
} from '#graphql/hooks';
import type { InstanceInfoData, InstanceStatsData } from '#graphql/hooks';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InstanceInformation {
  backend_version: string;
  python_version: string;
  platform: string;
}

export interface InstanceStatistics {
  total_files: number;
  active_files: number;
  expired_files: number;
  total_storage_used: number;
  total_users: number;
}

// ─── Prefetch ──────────────────────────────────────────────────────────────────

export const prefetchInstanceInformation = async () => {
  const source = client.query(INSTANCE_INFO_QUERY, {});
  await source.toPromise();
};

export const prefetchInstanceStatistics = async () => {
  const source = client.query(INSTANCE_STATS_QUERY, {});
  await source.toPromise();
};

// ─── Query Hooks ───────────────────────────────────────────────────────────────

export const useInstanceInformationQuery = () => {
  const rawInfo = useInstanceInfoQuery();

  const info = $derived({
    data: rawInfo.data ? mapInstanceInfo(rawInfo.data.instance_information) : undefined,
    isLoading: rawInfo.fetching,
    error: rawInfo.error ? new Error(rawInfo.error) : null
  });

  return { info };
};

export const useInstanceStatisticsQuery = () => {
  const rawStats = useInstanceStatsQuery();

  const stats = $derived({
    data: rawStats.data ? mapInstanceStats(rawStats.data.instance_statistics) : undefined,
    isLoading: rawStats.fetching,
    error: rawStats.error ? new Error(rawStats.error) : null
  });

  return { stats };
};

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapInstanceInfo(
  data: InstanceInfoData['instance_information']
): InstanceInformation {
  return {
    backend_version: data.backend_version,
    python_version: data.python_version,
    platform: data.platform
  };
}

function mapInstanceStats(
  data: InstanceStatsData['instance_statistics']
): InstanceStatistics {
  return {
    total_files: data.total_files,
    active_files: data.active_files,
    expired_files: data.expired_files,
    total_storage_used: data.total_storage_used,
    total_users: data.total_users
  };
}
