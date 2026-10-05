import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { Api } from '#consts/backend';
import { login } from '$lib/remote/auth.server';
import {
	CompleteOnboardingDocument,
	LoginDocument
} from '$lib/graphql/generated/graphql.js';

/**
 * Onboarding server actions.
 *
 * `create_admin` performs the full stage-1 flow server-side:
 *   1. Create the admin account via the `completeOnboarding` GraphQL mutation
 *   2. Log in via the `login` GraphQL mutation and set the `access_token`
 *      HttpOnly cookie
 *
 * Both steps run in the SvelteKit server, so no secrets or cookies ever touch
 * the browser.
 */

const createAdminSchema = z.object({
	username: z.string().min(1),
	email: z.string().min(1),
	password: z.string().min(1)
});

const GRAPHQL_URL = `${Api.BASE}/graphql/`;

export const actions = {
	create_admin: async ({ request, fetch, url }: {
		request: Request;
		fetch: typeof globalThis.fetch;
		url: URL;
	}) => {
		const body = await request.formData();
		const username = String(body.get('username') ?? '');
		const email = String(body.get('email') ?? '');
		const password = String(body.get('password') ?? '');

		const parsed = createAdminSchema.safeParse({ username, email, password });
		if (!parsed.success) {
			return fail(400, { error: 'All fields are required' });
		}

		// 1. Create the admin account.
		const onboardingRes = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: CompleteOnboardingDocument,
				variables: {
					username,
					email,
					password,
					siteDescription: ''
				}
			})
		});

		const onboardingData = await onboardingRes.json().catch(() => ({}));
		if (!onboardingRes.ok || onboardingData?.errors?.length) {
			const msg =
				onboardingData?.errors?.[0]?.message ||
				onboardingData?.detail ||
				'Failed to create admin account';
			return fail(400, { error: msg });
		}

		// 2. Log in and set the auth cookie.
		try {
			await login({ username, password });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to log in';
			return fail(401, { error: msg });
		}

		return { success: true };
	}
};
