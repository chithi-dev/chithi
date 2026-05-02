import { Api } from '#consts/backend';
import { createQuery } from '@tanstack/svelte-query';

const queryKey = ['instance-information'];

const fetchInstanceInformation = async () => {
	const res = await fetch(Api.INSTANCE);
	if (!res.ok) {
		throw new Error('Failed to fetch instance information');
	}
	return res.json();
};

const fetchInstanceStatistics = async () => {
	const res = await fetch(Api.INSTANCE_STATISTICS);
	if (!res.ok) {
		throw new Error('Failed to fetch instance statistics');
	}
	return res.json();
};

export const useInstanceInformationQuery = () => {
	return createQuery(() => ({
		queryKey: ['instance-information'],
		queryFn: fetchInstanceInformation,
		staleTime: 1000 * 60 * 5 // 5 minutes
	}));
};

export const useInstanceStatisticsQuery = () => {
	return createQuery(() => ({
		queryKey: ['instance-statistics'],
		queryFn: fetchInstanceStatistics,
		staleTime: 1000 * 60 * 5 // 5 minutes
	}));
};
