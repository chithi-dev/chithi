import { client } from '$lib/graphql/client.js';
import { INSTANCE_INFO_QUERY, INSTANCE_STATS_QUERY } from '$lib/graphql/queries.js';
import {
  useInstanceInfoQuery,
  useInstanceStatsQuery
} from '$lib/graphql/hooks.js';
import type { InstanceInfoData, InstanceStatsData } from '$lib/graphql/hooks.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InstanceInformation {
  backend_version: string;
  python_version: string;
  platform: string;
  commit: string;
  is_release: boolean;
  version: string;
  fastapi_version: string;
  redis_version: string;
  postgres_version: string;
}

export interface InstanceStatistics {
  total_files: number;
  active_files: number;
  expired_files: number;
  total_storage_used: number;
  total_users: number;
  total_bytes: number;
  total_downloads: number;
  active_urls: number;
  active_rooms: number;
  expiring_soon: number;
  latest_expiry: string | null;
  oldest_file: string | null;
  newest_file: string | null;
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
    platform: data.platform,
    commit: data.commit,
    is_release: data.is_release,
    version: data.version,
    fastapi_version: data.fastapi_version,
    redis_version: data.redis_version,
    postgres_version: data.postgres_version
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
    total_users: data.total_users,
    total_bytes: data.total_bytes,
    total_downloads: data.total_downloads,
    active_urls: data.active_urls,
    active_rooms: data.active_rooms,
    expiring_soon: data.expiring_soon,
    latest_expiry: data.latest_expiry,
    oldest_file: data.oldest_file,
    newest_file: data.newest_file
  };
}
