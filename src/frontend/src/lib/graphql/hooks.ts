import type { DocumentNode } from 'graphql';
import { client } from './client.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QueryState<Data> {
	data: Data | undefined;
	error: string | undefined;
	fetching: boolean;
	stale: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a Svelte 5 readable store backed by an Apollo watchQuery.
 * The subscription is cleaned up when the component is destroyed (via $effect cleanup).
 */
function createQueryStore<Data = any>(
	query: DocumentNode,
	variables: Record<string, any> = {}
) {
	const initialState: QueryState<Data> = {
		data: undefined,
		error: undefined,
		fetching: true,
		stale: false
	};

	let state = $state<QueryState<Data>>(initialState);

	const observable = client.watchQuery<Data>({ query, variables });

	const subscription = observable.subscribe({
		next(result) {
			state.fetching = result.loading;
			state.stale = false;
			state.data = result.data as Data | undefined;
			state.error = result.error?.message ?? undefined;
		},
		error(err) {
			state.fetching = false;
			state.error = err.message;
		}
	});

	$effect(() => {
		return () => {
			subscription.unsubscribe();
		};
	});

	return state;
}

// ─── Query Hooks ───────────────────────────────────────────────────────────────

import {
	ADMIN_FILES_QUERY,
	CONFIG_QUERY,
	FILE_INFO_QUERY,
	INSTANCE_INFO_QUERY,
	INSTANCE_STATS_QUERY,
	ME_QUERY,
	ONBOARDING_QUERY
} from './queries.js';

export interface ConfigData {
	config: {
		totalStorageLimit: number;
		maxFileSizeLimit: number;
		defaultExpiry: number;
		defaultNumberOfDownloads: number;
		siteDescription: string;
		downloadConfigs: number[];
		timeConfigs: number[];
		allowedFileTypes: string[];
		bannedFileTypes: string[];
		allowUploads: boolean;
	};
}

export interface OnboardingData {
	onboarding: {
		isConfigured: boolean;
		hasUsers: boolean;
	};
}

export interface UserData {
	id: string;
	username: string;
	email: string | null;
	createdAt: string;
}

export interface MeData {
	me: UserData | null;
}

export interface InstanceInfoData {
	instanceInformation: {
		backendVersion: string;
		pythonVersion: string;
		platform: string;
	};
}

export interface InstanceStatsData {
	instanceStatistics: {
		totalFiles: number;
		activeFiles: number;
		expiredFiles: number;
		totalStorageUsed: number;
		totalUsers: number;
	};
}

export interface FileInfoItem {
	id: string;
	key: string;
	filename: string;
	size: number;
	numberOfFiles: number | null;
	downloadCount: number;
	createdAt: string;
	expiresAt: string;
	expireAfterNDownload: number;
	isExpired: boolean;
}

export interface FileInfoData {
	fileInfo: FileInfoItem | null;
}

export interface AdminFilesData {
	adminFiles: {
		items: FileInfoItem[];
		total: number;
		page: number;
		size: number;
		pages: number;
	};
}

/** Fetch the site configuration. */
export function useConfigQuery() {
	return createQueryStore<ConfigData>(CONFIG_QUERY);
}

/** Fetch the onboarding status. */
export function useOnboardingQuery() {
	return createQueryStore<OnboardingData>(ONBOARDING_QUERY);
}

/** Fetch the current authenticated user. */
export function useMeQuery() {
	return createQueryStore<MeData>(ME_QUERY);
}

/** Fetch instance version information. */
export function useInstanceInfoQuery() {
	return createQueryStore<InstanceInfoData>(INSTANCE_INFO_QUERY);
}

/** Fetch instance statistics. */
export function useInstanceStatsQuery() {
	return createQueryStore<InstanceStatsData>(INSTANCE_STATS_QUERY);
}

/** Fetch info for a single file by its slug (S3 key). */
export function useFileInfoQuery(slug: string) {
	return createQueryStore<FileInfoData>(FILE_INFO_QUERY, { slug });
}

/** Fetch paginated file list for admin. */
export function useAdminFilesQuery(
	page: number = 1,
	size: number = 20,
	search: string | null = null
) {
	return createQueryStore<AdminFilesData>(ADMIN_FILES_QUERY, { page, size, search });
}

// ─── Mutation Helpers ──────────────────────────────────────────────────────────

/**
 * Execute a GraphQL mutation and return its result.
 * Returns a promise that resolves to the mutation result.
 */
export async function executeMutation<Data = any>(
	mutation: DocumentNode,
	variables: Record<string, any> = {}
) {
	return await client.mutate<Data>({ mutation, variables });
}

// Convenience mutation wrappers

import {
	COMPLETE_ONBOARDING_MUTATION,
	CREATE_USER_MUTATION,
	DELETE_FILE_MUTATION,
	DELETE_USER_MUTATION,
	LOGIN_MUTATION,
	LOGOUT_MUTATION,
	UPDATE_CONFIG_MUTATION,
	UPDATE_USER_MUTATION,
	UPLOAD_FILE_MUTATION
} from './queries.js';

export interface LoginResult {
	login: { access: string; refresh: string };
}

export interface LogoutResult {
	logout: boolean;
}

export interface UploadFileResult {
	uploadFile: FileInfoItem;
}

export interface CompleteOnboardingResult {
	completeOnboarding: { access: string; refresh: string; onboarded: boolean };
}

export interface DeleteFileResult {
	deleteFile: boolean;
}

export interface CreateUserResult {
	createUser: UserData;
}

export interface UpdateUserResult {
	updateUser: UserData;
}

export interface DeleteUserResult {
	deleteUser: boolean;
}

export interface UpdateConfigResult {
	updateConfig: {
		totalStorageLimit: number;
		maxFileSizeLimit: number;
		defaultExpiry: number;
		defaultNumberOfDownloads: number;
		siteDescription: string;
		downloadConfigs: number[];
		timeConfigs: number[];
		allowedFileTypes: string[];
		bannedFileTypes: string[];
		allowUploads: boolean;
	};
}

export async function loginMutation(username: string, password: string) {
	return await executeMutation<LoginResult>(LOGIN_MUTATION, { username, password });
}

export async function logoutMutation() {
	return await executeMutation<LogoutResult>(LOGOUT_MUTATION);
}

export async function uploadFileMutation(
	filename: string,
	expiresAt: number,
	expireAfterNDownload: number,
	numberOfFiles?: number | null
) {
	return await executeMutation<UploadFileResult>(UPLOAD_FILE_MUTATION, {
		filename,
		expiresAt,
		expireAfterNDownload,
		numberOfFiles
	});
}

export async function completeOnboardingMutation(
	username: string,
	email: string,
	password: string,
	siteDescription: string
) {
	return await executeMutation<CompleteOnboardingResult>(COMPLETE_ONBOARDING_MUTATION, {
		username,
		email,
		password,
		siteDescription
	});
}

export async function deleteFileMutation(id: string) {
	return await executeMutation<DeleteFileResult>(DELETE_FILE_MUTATION, { id });
}

export async function createUserMutation(
	username: string,
	password: string,
	email?: string | null
) {
	return await executeMutation<CreateUserResult>(CREATE_USER_MUTATION, {
		username,
		password,
		email
	});
}

export async function updateUserMutation(
	id: string,
	username?: string | null,
	email?: string | null
) {
	return await executeMutation<UpdateUserResult>(UPDATE_USER_MUTATION, {
		id,
		username,
		email
	});
}

export async function deleteUserMutation(id: string) {
	return await executeMutation<DeleteUserResult>(DELETE_USER_MUTATION, { id });
}

export async function updateConfigMutation(params: {
	totalStorageLimit?: number | null;
	maxFileSizeLimit?: number | null;
	defaultExpiry?: number | null;
	defaultNumberOfDownloads?: number | null;
	siteDescription?: string | null;
	allowUploads?: boolean | null;
}) {
	return await executeMutation<UpdateConfigResult>(UPDATE_CONFIG_MUTATION, params);
}
