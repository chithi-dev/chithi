import type { ConfigOut } from '../types';
import { gqlFetch } from '../client';

export const UPDATE_CONFIG_MUTATION = `
	mutation UpdateConfig($input: ConfigUpdateInput!) {
		updateConfig(input: $input) {
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

export async function updateConfig(input: Record<string, unknown>): Promise<Partial<ConfigOut>> {
	return gqlFetch<Partial<ConfigOut>>(UPDATE_CONFIG_MUTATION, { input });
}
