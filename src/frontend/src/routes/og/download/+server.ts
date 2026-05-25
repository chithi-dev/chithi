import type { RequestHandler } from '@sveltejs/kit';
import { buildOgResponse } from '../og-response';

export const GET: RequestHandler = (event) => buildOgResponse(event, 'download');
