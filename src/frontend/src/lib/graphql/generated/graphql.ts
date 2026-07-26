/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type ConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type ConfigQuery = { __typename: 'Query', config: { __typename: 'ConfigType', totalStorageLimit: number, maxFileSizeLimit: number, defaultExpiry: number, defaultNumberOfDownloads: number, siteDescription: string, downloadConfigs: Array<number>, timeConfigs: Array<number>, allowedFileTypes: Array<string>, bannedFileTypes: Array<string>, allowUploads: boolean } };

export type OnboardingQueryVariables = Exact<{ [key: string]: never; }>;


export type OnboardingQuery = { __typename: 'Query', onboarding: { __typename: 'OnboardingType', isConfigured: boolean, hasUsers: boolean } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename: 'Query', me: { __typename: 'UserType', id: string, username: string, email: string | null, createdAt: unknown } | null };

export type InstanceInformationQueryVariables = Exact<{ [key: string]: never; }>;


export type InstanceInformationQuery = { __typename: 'Query', instanceInformation: { __typename: 'InstanceInfoType', backendVersion: string, pythonVersion: string, platform: string } };

export type InstanceStatisticsQueryVariables = Exact<{ [key: string]: never; }>;


export type InstanceStatisticsQuery = { __typename: 'Query', instanceStatistics: { __typename: 'InstanceStatisticsType', totalFiles: number, activeFiles: number, expiredFiles: number, totalStorageUsed: number, totalUsers: number } };

export type FileInfoQueryVariables = Exact<{
  slug: string;
}>;


export type FileInfoQuery = { __typename: 'Query', fileInfo: { __typename: 'FileType', id: string, key: string, filename: string, size: number, numberOfFiles: number | null, downloadCount: number, createdAt: unknown, expiresAt: unknown, expireAfterNDownload: number, isExpired: boolean } | null };

export type AdminFilesQueryVariables = Exact<{
  page?: number | null | undefined;
  size?: number | null | undefined;
  search?: string | null | undefined;
}>;


export type AdminFilesQuery = { __typename: 'Query', adminFiles: { __typename: 'PaginatedFiles', total: number, page: number, size: number, pages: number, items: Array<{ __typename: 'FileType', id: string, key: string, filename: string, size: number, numberOfFiles: number | null, downloadCount: number, createdAt: unknown, expiresAt: unknown, expireAfterNDownload: number, isExpired: boolean }> } };

export type UsersQueryVariables = Exact<{ [key: string]: never; }>;


export type UsersQuery = { __typename: 'Query', users: Array<{ __typename: 'UserType', id: string, username: string, email: string | null, createdAt: unknown }> };

export type LoginMutationVariables = Exact<{
  username: string;
  password: string;
}>;


export type LoginMutation = { __typename: 'Mutation', login: { __typename: 'TokenResponse', access: string, refresh: string } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename: 'Mutation', logout: boolean };

export type UploadFileMutationVariables = Exact<{
  file: unknown;
  filename: string;
  expiresAt: number;
  expireAfterNDownload: number;
  numberOfFiles?: number | null | undefined;
}>;


export type UploadFileMutation = { __typename: 'Mutation', uploadFile: { __typename: 'FileType', id: string, key: string, filename: string, size: number, numberOfFiles: number | null, downloadCount: number, createdAt: unknown, expiresAt: unknown, expireAfterNDownload: number, isExpired: boolean } };

export type CompleteOnboardingMutationVariables = Exact<{
  username: string;
  email: string;
  password: string;
  siteDescription: string;
}>;


export type CompleteOnboardingMutation = { __typename: 'Mutation', completeOnboarding: { __typename: 'OnboardingPOSTOut', access: string, refresh: string, onboarded: boolean } };

export type DeleteFileMutationVariables = Exact<{
  fileId: string | number;
}>;


export type DeleteFileMutation = { __typename: 'Mutation', deleteFile: boolean };

export type CreateUserMutationVariables = Exact<{
  username: string;
  password: string;
  email?: string | null | undefined;
}>;


export type CreateUserMutation = { __typename: 'Mutation', createUser: { __typename: 'UserType', id: string, username: string, email: string | null, createdAt: unknown } };

export type UpdateUserMutationVariables = Exact<{
  userId: string | number;
  username?: string | null | undefined;
  email?: string | null | undefined;
}>;


export type UpdateUserMutation = { __typename: 'Mutation', updateUser: { __typename: 'UserType', id: string, username: string, email: string | null, createdAt: unknown } };

export type DeleteUserMutationVariables = Exact<{
  userId: string | number;
}>;


export type DeleteUserMutation = { __typename: 'Mutation', deleteUser: boolean };

export type UpdateConfigMutationVariables = Exact<{
  totalStorageLimit?: number | null | undefined;
  maxFileSizeLimit?: number | null | undefined;
  defaultExpiry?: number | null | undefined;
  defaultNumberOfDownloads?: number | null | undefined;
  siteDescription?: string | null | undefined;
  allowUploads?: boolean | null | undefined;
}>;


export type UpdateConfigMutation = { __typename: 'Mutation', updateConfig: { __typename: 'ConfigType', totalStorageLimit: number, maxFileSizeLimit: number, defaultExpiry: number, defaultNumberOfDownloads: number, siteDescription: string, downloadConfigs: Array<number>, timeConfigs: Array<number>, allowedFileTypes: Array<string>, bannedFileTypes: Array<string>, allowUploads: boolean } };


export const ConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Config"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"config"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalStorageLimit"}},{"kind":"Field","name":{"kind":"Name","value":"maxFileSizeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"defaultExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"defaultNumberOfDownloads"}},{"kind":"Field","name":{"kind":"Name","value":"siteDescription"}},{"kind":"Field","name":{"kind":"Name","value":"downloadConfigs"}},{"kind":"Field","name":{"kind":"Name","value":"timeConfigs"}},{"kind":"Field","name":{"kind":"Name","value":"allowedFileTypes"}},{"kind":"Field","name":{"kind":"Name","value":"bannedFileTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowUploads"}}]}}]}}]} as unknown as DocumentNode<ConfigQuery, ConfigQueryVariables>;
export const OnboardingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Onboarding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onboarding"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isConfigured"}},{"kind":"Field","name":{"kind":"Name","value":"hasUsers"}}]}}]}}]} as unknown as DocumentNode<OnboardingQuery, OnboardingQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const InstanceInformationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InstanceInformation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceInformation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"backendVersion"}},{"kind":"Field","name":{"kind":"Name","value":"pythonVersion"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}}]}}]}}]} as unknown as DocumentNode<InstanceInformationQuery, InstanceInformationQueryVariables>;
export const InstanceStatisticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InstanceStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalFiles"}},{"kind":"Field","name":{"kind":"Name","value":"activeFiles"}},{"kind":"Field","name":{"kind":"Name","value":"expiredFiles"}},{"kind":"Field","name":{"kind":"Name","value":"totalStorageUsed"}},{"kind":"Field","name":{"kind":"Name","value":"totalUsers"}}]}}]}}]} as unknown as DocumentNode<InstanceStatisticsQuery, InstanceStatisticsQueryVariables>;
export const FileInfoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FileInfo"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileInfo"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"size"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfFiles"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"expireAfterNDownload"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}}]}}]}}]} as unknown as DocumentNode<FileInfoQuery, FileInfoQueryVariables>;
export const AdminFilesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminFiles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"size"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminFiles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"size"},"value":{"kind":"Variable","name":{"kind":"Name","value":"size"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"size"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfFiles"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"expireAfterNDownload"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"size"}},{"kind":"Field","name":{"kind":"Name","value":"pages"}}]}}]}}]} as unknown as DocumentNode<AdminFilesQuery, AdminFilesQueryVariables>;
export const UsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<UsersQuery, UsersQueryVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"access"}},{"kind":"Field","name":{"kind":"Name","value":"refresh"}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const UploadFileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadFile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"file"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Upload"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filename"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expiresAt"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"expireAfterNDownload"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"numberOfFiles"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uploadFile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"file"},"value":{"kind":"Variable","name":{"kind":"Name","value":"file"}}},{"kind":"Argument","name":{"kind":"Name","value":"filename"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filename"}}},{"kind":"Argument","name":{"kind":"Name","value":"expiresAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expiresAt"}}},{"kind":"Argument","name":{"kind":"Name","value":"expireAfterNDownload"},"value":{"kind":"Variable","name":{"kind":"Name","value":"expireAfterNDownload"}}},{"kind":"Argument","name":{"kind":"Name","value":"numberOfFiles"},"value":{"kind":"Variable","name":{"kind":"Name","value":"numberOfFiles"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"size"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfFiles"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"expireAfterNDownload"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}}]}}]}}]} as unknown as DocumentNode<UploadFileMutation, UploadFileMutationVariables>;
export const CompleteOnboardingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteOnboarding"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteDescription"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeOnboarding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"siteDescription"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteDescription"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"access"}},{"kind":"Field","name":{"kind":"Name","value":"refresh"}},{"kind":"Field","name":{"kind":"Name","value":"onboarded"}}]}}]}}]} as unknown as DocumentNode<CompleteOnboardingMutation, CompleteOnboardingMutationVariables>;
export const DeleteFileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fileId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fileId"}}}]}]}}]} as unknown as DocumentNode<DeleteFileMutation, DeleteFileMutationVariables>;
export const CreateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateUserMutation, CreateUserMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const DeleteUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}]}}]} as unknown as DocumentNode<DeleteUserMutation, DeleteUserMutationVariables>;
export const UpdateConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"totalStorageLimit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxFileSizeLimit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"defaultExpiry"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"defaultNumberOfDownloads"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteDescription"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"allowUploads"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"totalStorageLimit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"totalStorageLimit"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxFileSizeLimit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxFileSizeLimit"}}},{"kind":"Argument","name":{"kind":"Name","value":"defaultExpiry"},"value":{"kind":"Variable","name":{"kind":"Name","value":"defaultExpiry"}}},{"kind":"Argument","name":{"kind":"Name","value":"defaultNumberOfDownloads"},"value":{"kind":"Variable","name":{"kind":"Name","value":"defaultNumberOfDownloads"}}},{"kind":"Argument","name":{"kind":"Name","value":"siteDescription"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteDescription"}}},{"kind":"Argument","name":{"kind":"Name","value":"allowUploads"},"value":{"kind":"Variable","name":{"kind":"Name","value":"allowUploads"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalStorageLimit"}},{"kind":"Field","name":{"kind":"Name","value":"maxFileSizeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"defaultExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"defaultNumberOfDownloads"}},{"kind":"Field","name":{"kind":"Name","value":"siteDescription"}},{"kind":"Field","name":{"kind":"Name","value":"downloadConfigs"}},{"kind":"Field","name":{"kind":"Name","value":"timeConfigs"}},{"kind":"Field","name":{"kind":"Name","value":"allowedFileTypes"}},{"kind":"Field","name":{"kind":"Name","value":"bannedFileTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowUploads"}}]}}]}}]} as unknown as DocumentNode<UpdateConfigMutation, UpdateConfigMutationVariables>;