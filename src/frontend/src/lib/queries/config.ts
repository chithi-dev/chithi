import { Api } from '#consts/backend';
import { makeFetcher, makeQuery } from './fetch-utils';

export interface Config {
	total_storage_limit: number;
	max_file_size_limit: number;
	default_expiry: number;
	default_number_of_downloads: number;
	site_description: string;
	download_configs: number[];
	time_configs: number[];
	allowed_file_types: string[];
	banned_file_types: string[];
	allow_uploads: boolean;
}

type ConfigUpdate = Partial<Config>;

const fetcher = makeFetcher<Config>(Api.CONFIG, 'config');
const q = makeQuery(fetcher, 'config');

export const prefetch = q.prefetch;

export const useConfigQuery = () => {
	const { query, qc } = q.useQuery();

	const updateConfig = async (data: Partial<ConfigUpdate>) => {
		const res = await fetch(Api.ADMIN.CONFIG, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});
		if (res.ok) await qc.invalidateQueries({ queryKey: ['config'] });
	};

	return { config: query, updateConfig };
};
