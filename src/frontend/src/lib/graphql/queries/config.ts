import type { ConfigOut } from '../types';
import { gqlFetch } from '../client';

export const GET_CONFIG = `
	query GetConfig {
		config {
			id
			total_storage_limit
			max_file_size_limit
			default_expiry
			default_number_of_downloads
			site_description
			download_configs
			time_configs
			allowed_file_types
			banned_file_types
			allow_uploads
		}
	}
`;

export async function getConfig(): Promise<ConfigOut> {
	return gqlFetch<Partial<ConfigOut>>(GET_CONFIG);
}
