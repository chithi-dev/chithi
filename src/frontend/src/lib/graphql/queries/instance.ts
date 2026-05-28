import type { InstanceInfoOut, InstanceStatisticsOut } from '../types';
import { gqlFetch } from '../client';

export const GET_INSTANCE_INFO = `
	query GetInstanceInformation {
		instanceInformation {
			pythonVersion
			djangoVersion
			redisVersion
			postgresVersion
			version
			commit
			isRelease
		}
	}
`;

export const GET_INSTANCE_STATS = `
	query GetInstanceStatistics {
		instanceStatistics {
			totalBytes
			totalFiles
			totalDownloads
			activeUrls
			activeRooms
			linksWithDownloadCaps
			expiringSoon
			latestExpiry
		}
	}
`;

export async function getInstanceInfo(): Promise<InstanceInfoOut> {
	return gqlFetch<Partial<InstanceInfoOut>>(GET_INSTANCE_INFO);
}

export async function getInstanceStatistics(): Promise<InstanceStatisticsOut> {
	return gqlFetch<Partial<InstanceStatisticsOut>>(GET_INSTANCE_STATS);
}
