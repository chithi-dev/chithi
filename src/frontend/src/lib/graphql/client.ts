/**
 * Apollo Client v4 - the single browser GraphQL transport.
 *
 * Auth: the session JWT lives in an HttpOnly cookie that the SvelteKit server
 * resolves into `event.locals.session` and exposes via `+layout.server.ts`
 * page data. The root layout `$effect` hydrates `lib/auth/store.svelte.ts`
 * from that data. This client reads the token from the store via
 * `getAuthToken()` and sends it as an `Authorization: Bearer` header on
 * every request - no manual cookie reading needed in the browser.
 *
 * `credentials: 'include'` is also set so the HttpOnly cookie is forwarded
 * on same-origin requests as a fallback (e.g. during SSR prefetch hydration
 * or if the backend adds cookie-based auth alongside header auth).
 */
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';
import UploadHttpLink from 'apollo-upload-client/UploadHttpLink.mjs';
import { Api } from '#consts/backend';
import { getAuthToken } from '$lib/auth/store.svelte';

const authLink = new SetContextLink((_prevCtx, _op) => {
	const token = getAuthToken();
	return token ? { headers: { authorization: `Bearer ${token}` } } : {};
});

const uploadLink = new UploadHttpLink({
	uri: Api.GRAPHQL,
	credentials: 'include',
	fetch,
});

export const client = new ApolloClient({
	link: authLink.concat(uploadLink),
	cache: new InMemoryCache(),
});
