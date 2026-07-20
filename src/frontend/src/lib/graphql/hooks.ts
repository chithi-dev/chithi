import type { OperationResult } from '@urql/core';
import { client } from './client.js';
import type { DocumentInput } from '@urql/core';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QueryState<Data> {
  data: Data | undefined;
  error: string | undefined;
  fetching: boolean;
  stale: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a Svelte 5 readable store backed by a urql query source.
 * The source is subscribed on creation and cleaned up when the component
 * that uses it is destroyed (via $effect cleanup).
 */
function createQueryStore<Data = any>(
  query: DocumentInput<Data>,
  variables: Record<string, any> = {}
) {
  const initialState: QueryState<Data> = {
    data: undefined,
    error: undefined,
    fetching: true,
    stale: false
  };

  let state = $state<QueryState<Data>>(initialState);

  const source = client.query(query, variables);

  const subscription = source.subscribe((result: OperationResult<Data>) => {
    state.fetching = result.operation.kind === 'query' && result.stale;
    state.stale = result.stale;
    state.data = result.data;
    state.error = result.error ? result.error.message : undefined;
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
  CONFIG_QUERY,
  ONBOARDING_QUERY,
  ME_QUERY,
  INSTANCE_INFO_QUERY,
  INSTANCE_STATS_QUERY,
  FILE_INFO_QUERY,
  ADMIN_FILES_QUERY,
} from './queries.js';

export interface ConfigData {
  config: {
    total_storage_limit: number;
    max_file_size_limit: number;
    default_expiry: number;
    default_number_of_downloads: number;
    site_description: string;
    download_configs: number[];
    time_configs: number[];
    allowed_file_types: string[];
    banned_file_types: string[];
    allow_uploads: boolean;
  };
}

export interface OnboardingData {
  onboarding: {
    is_configured: boolean;
    has_users: boolean;
  };
}

export interface UserData {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
}

export interface MeData {
  me: UserData | null;
}

export interface InstanceInfoData {
  instance_information: {
    backend_version: string;
    python_version: string;
    platform: string;
    commit: string;
    is_release: boolean;
    version: string;
    fastapi_version: string;
    redis_version: string;
    postgres_version: string;
  };
}

export interface InstanceStatsData {
  instance_statistics: {
    total_files: number;
    active_files: number;
    expired_files: number;
    total_storage_used: number;
    total_users: number;
    total_bytes: number;
    total_downloads: number;
    active_urls: number;
    active_rooms: number;
    expiring_soon: number;
    latest_expiry: string | null;
    oldest_file: string | null;
    newest_file: string | null;
  };
}

export interface FileInfoItem {
  id: string;
  key: string;
  filename: string;
  size: number;
  number_of_files: number | null;
  download_count: number;
  created_at: string;
  expires_at: string;
  expire_after_n_download: number;
  is_expired: boolean;
}

export interface FileInfoData {
  file_info: FileInfoItem | null;
}

export interface AdminFilesData {
  admin_files: {
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
export function useAdminFilesQuery(page: number = 1, size: number = 20, search: string | null = null) {
  return createQueryStore<AdminFilesData>(ADMIN_FILES_QUERY, { page, size, search });
}

// ─── Mutation Helpers ──────────────────────────────────────────────────────────

/**
 * Execute a GraphQL mutation and return its result.
 * Returns a promise that resolves to the operation result.
 */
export async function executeMutation<Data = any>(
  mutation: DocumentInput<Data>,
  variables: Record<string, any> = {}
) {
  const source = client.mutation(mutation, variables);
  return await source.toPromise();
}

// Convenience mutation wrappers

import {
  LOGIN_MUTATION,
  LOGOUT_MUTATION,
  UPLOAD_FILE_MUTATION,
  COMPLETE_ONBOARDING_MUTATION,
  DELETE_FILE_MUTATION,
  CREATE_USER_MUTATION,
  UPDATE_USER_MUTATION,
  DELETE_USER_MUTATION,
  UPDATE_CONFIG_MUTATION
} from './queries.js';

export interface LoginResult {
  login: { access: string; refresh: string };
}

export interface LogoutResult {
  logout: boolean;
}

export interface UploadFileResult {
  upload_file: FileInfoItem;
}

export interface CompleteOnboardingResult {
  complete_onboarding: { access: string; refresh: string; onboarded: boolean };
}

export interface DeleteFileResult {
  delete_file: boolean;
}

export interface CreateUserResult {
  create_user: UserData;
}

export interface UpdateUserResult {
  update_user: UserData;
}

export interface DeleteUserResult {
  delete_user: boolean;
}

export interface UpdateConfigResult {
  update_config: {
    total_storage_limit: number;
    max_file_size_limit: number;
    default_expiry: number;
    default_number_of_downloads: number;
    site_description: string;
    download_configs: number[];
    time_configs: number[];
    allowed_file_types: string[];
    banned_file_types: string[];
    allow_uploads: boolean;
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
  expire_after: number,
  expire_after_n_download: number,
  number_of_files?: number | null
) {
  return await executeMutation<UploadFileResult>(UPLOAD_FILE_MUTATION, {
    filename,
    expire_after,
    expire_after_n_download,
    number_of_files
  });
}

export async function completeOnboardingMutation(
  username: string,
  email: string,
  password: string,
  site_description: string
) {
  return await executeMutation<CompleteOnboardingResult>(COMPLETE_ONBOARDING_MUTATION, {
    username,
    email,
    password,
    site_description
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
  total_storage_limit?: number | null;
  max_file_size_limit?: number | null;
  default_expiry?: number | null;
  default_number_of_downloads?: number | null;
  site_description?: string | null;
  allow_uploads?: boolean | null;
}) {
  return await executeMutation<UpdateConfigResult>(UPDATE_CONFIG_MUTATION, params);
}
