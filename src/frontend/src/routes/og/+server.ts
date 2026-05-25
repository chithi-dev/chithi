import type { RequestHandler } from '@sveltejs/kit';
import { parseOgKind } from './og-config';
import { buildOgResponse } from './og-response';

export const GET: RequestHandler = (event) => {
	const kind = parseOgKind(event.url.searchParams.get('type'));
	return buildOgResponse(event, kind);
};
