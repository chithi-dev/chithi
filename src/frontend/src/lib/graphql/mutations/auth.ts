import type { LoginResult, OnboardingStatus } from '../types';
import { gqlFetch } from '../client';

export const LOGIN_MUTATION = `
	mutation Login($username: String!, $password: String!) {
		login(username: $username, password: $password) {
			accessToken
			tokenType
		}
	}
`;

export const ONBOARD_MUTATION = `
	mutation Onboard($username: String!, $email: String, $password: String!) {
		onboard(username: $username, email: $email, password: $password) {
			onboarded
		}
	}
`;

export const UPDATE_CURRENT_USER_MUTATION = `
	mutation UpdateCurrentUser($username: String, $email: String) {
		updateCurrentUser(username: $username, email: $email) {
			id
			username
			email
		}
	}
`;

export async function login(username: string, password: string): Promise<LoginResult> {
	return gqlFetch<Partial<LoginResult>>(LOGIN_MUTATION, { username, password });
}

export async function onboard(
	username: string,
	email?: string | null,
	password?: string,
): Promise<OnboardingStatus> {
	if (!password) throw new Error('Password is required for onboarding');
	return gqlFetch<OnboardingStatus>(ONBOARD_MUTATION, { username, email, password });
}

export async function updateCurrentUser(
	username?: string,
	email?: string | null,
): Promise<Record<string, unknown>> {
	return gqlFetch<Partial<Record<string, unknown>>>(UPDATE_CURRENT_USER_MUTATION, {
		username,
		email,
	});
}
