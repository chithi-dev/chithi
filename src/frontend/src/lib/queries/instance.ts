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

export const useInstanceInformationQuery = () => {
	return createQuery(() => ({
		queryKey,
		queryFn: fetchInstanceInformation,
		staleTime: 1000 * 60 * 5 // 5 minutes
	}));
};
