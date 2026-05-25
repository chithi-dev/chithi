import type { RequestHandler } from '@sveltejs/kit';
import { OgKind } from '../og-enums';
import { buildOgResponse } from '../og-response';

export const GET: RequestHandler = (event) => buildOgResponse(event, OgKind.Info);
