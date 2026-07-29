import { env } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';

const BACKEND_URL = env.PUBLIC_BACKEND_API ?? 'http://localhost:8002';

/**
 * Proxy /graphql/ requests to the Django backend so the Apollo client
 * can use a relative URL in development without CORS issues.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/graphql')) {
		// Handle CORS preflight
		if (event.request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': event.url.origin,
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Allow-Credentials': 'true'
				}
			});
		}

		const backendUrl = new URL(event.url.pathname, BACKEND_URL).href;
		const fetchOptions: RequestInit = {
			method: event.request.method,
			headers: event.request.headers,
			credentials: 'include'
		};

		// For POST requests with a body (GraphQL mutations/queries)
		if (event.request.method !== 'GET') {
			fetchOptions.body = await event.request.clone().arrayBuffer();
		}

		const response = await fetch(backendUrl, fetchOptions);

		// Forward the response with correct CORS headers
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
				'Access-Control-Allow-Origin': event.url.origin,
				'Access-Control-Allow-Credentials': 'true'
			}
		});
	}

	return resolve(event);
};
