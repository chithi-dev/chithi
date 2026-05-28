import type { UserOut, OnboardingStatus } from '../types';
import { gqlFetch } from '../client';

export const GET_USER = `
	query GetUser {
		user {
			id
			username
			email
		}
	}
`;

export const GET_ONBOARDING_STATUS = `
	query OnboardingStatus {
		onboarding {
			onboarded
		}
	}
`;

export async function getUser(): Promise<UserOut> {
	return gqlFetch<Partial<UserOut>>(GET_USER);
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
	return gqlFetch<OnboardingStatus>(GET_ONBOARDING_STATUS);
}
