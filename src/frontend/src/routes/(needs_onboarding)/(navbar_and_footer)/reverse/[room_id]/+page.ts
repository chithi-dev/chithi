import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!params.room_id) {
		error(404, 'Invalid Room');
	}
};

export const trailingSlash = 'ignore';
