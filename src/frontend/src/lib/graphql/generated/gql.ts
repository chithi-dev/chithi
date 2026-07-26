/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n\tquery Config {\n\t\tconfig {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n": typeof types.ConfigDocument,
    "\n\tquery Onboarding {\n\t\tonboarding {\n\t\t\tisConfigured\n\t\t\thasUsers\n\t\t}\n\t}\n": typeof types.OnboardingDocument,
    "\n\tquery Me {\n\t\tme {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": typeof types.MeDocument,
    "\n\tquery InstanceInformation {\n\t\tinstanceInformation {\n\t\t\tbackendVersion\n\t\t\tpythonVersion\n\t\t\tplatform\n\t\t}\n\t}\n": typeof types.InstanceInformationDocument,
    "\n\tquery InstanceStatistics {\n\t\tinstanceStatistics {\n\t\t\ttotalFiles\n\t\t\tactiveFiles\n\t\t\texpiredFiles\n\t\t\ttotalStorageUsed\n\t\t\ttotalUsers\n\t\t}\n\t}\n": typeof types.InstanceStatisticsDocument,
    "\n\tquery FileInfo($slug: String!) {\n\t\tfileInfo(key: $slug) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n": typeof types.FileInfoDocument,
    "\n\tquery AdminFiles($page: Int, $size: Int, $search: String) {\n\t\tadminFiles(page: $page, size: $size, search: $search) {\n\t\t\titems {\n\t\t\t\tid\n\t\t\t\tkey\n\t\t\t\tfilename\n\t\t\t\tsize\n\t\t\t\tnumberOfFiles\n\t\t\t\tdownloadCount\n\t\t\t\tcreatedAt\n\t\t\t\texpiresAt\n\t\t\t\texpireAfterNDownload\n\t\t\t\tisExpired\n\t\t\t}\n\t\t\ttotal\n\t\t\tpage\n\t\t\tsize\n\t\t\tpages\n\t\t}\n\t}\n": typeof types.AdminFilesDocument,
    "\n\tquery Users {\n\t\tusers {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": typeof types.UsersDocument,
    "\n\tmutation Login($username: String!, $password: String!) {\n\t\tlogin(username: $username, password: $password) {\n\t\t\taccess\n\t\t\trefresh\n\t\t}\n\t}\n": typeof types.LoginDocument,
    "\n\tmutation Logout {\n\t\tlogout\n\t}\n": typeof types.LogoutDocument,
    "\n\tmutation UploadFile(\n\t\t$file: Upload!\n\t\t$filename: String!\n\t\t$expiresAt: Int!\n\t\t$expireAfterNDownload: Int!\n\t\t$numberOfFiles: Int\n\t) {\n\t\tuploadFile(\n\t\t\tfile: $file\n\t\t\tfilename: $filename\n\t\t\texpiresAt: $expiresAt\n\t\t\texpireAfterNDownload: $expireAfterNDownload\n\t\t\tnumberOfFiles: $numberOfFiles\n\t\t) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n": typeof types.UploadFileDocument,
    "\n\tmutation CompleteOnboarding(\n\t\t$username: String!\n\t\t$email: String!\n\t\t$password: String!\n\t\t$siteDescription: String!\n\t) {\n\t\tcompleteOnboarding(\n\t\t\tusername: $username\n\t\t\temail: $email\n\t\t\tpassword: $password\n\t\t\tsiteDescription: $siteDescription\n\t\t) {\n\t\t\taccess\n\t\t\trefresh\n\t\t\tonboarded\n\t\t}\n\t}\n": typeof types.CompleteOnboardingDocument,
    "\n\tmutation DeleteFile($fileId: ID!) {\n\t\tdeleteFile(fileId: $fileId)\n\t}\n": typeof types.DeleteFileDocument,
    "\n\tmutation CreateUser($username: String!, $password: String!, $email: String) {\n\t\tcreateUser(username: $username, password: $password, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": typeof types.CreateUserDocument,
    "\n\tmutation UpdateUser($userId: ID!, $username: String, $email: String) {\n\t\tupdateUser(userId: $userId, username: $username, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": typeof types.UpdateUserDocument,
    "\n\tmutation DeleteUser($userId: ID!) {\n\t\tdeleteUser(userId: $userId)\n\t}\n": typeof types.DeleteUserDocument,
    "\n\tmutation UpdateConfig(\n\t\t$totalStorageLimit: Int\n\t\t$maxFileSizeLimit: Int\n\t\t$defaultExpiry: Int\n\t\t$defaultNumberOfDownloads: Int\n\t\t$siteDescription: String\n\t\t$allowUploads: Boolean\n\t) {\n\t\tupdateConfig(\n\t\t\ttotalStorageLimit: $totalStorageLimit\n\t\t\tmaxFileSizeLimit: $maxFileSizeLimit\n\t\t\tdefaultExpiry: $defaultExpiry\n\t\t\tdefaultNumberOfDownloads: $defaultNumberOfDownloads\n\t\t\tsiteDescription: $siteDescription\n\t\t\tallowUploads: $allowUploads\n\t\t) {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n": typeof types.UpdateConfigDocument,
};
const documents: Documents = {
    "\n\tquery Config {\n\t\tconfig {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n": types.ConfigDocument,
    "\n\tquery Onboarding {\n\t\tonboarding {\n\t\t\tisConfigured\n\t\t\thasUsers\n\t\t}\n\t}\n": types.OnboardingDocument,
    "\n\tquery Me {\n\t\tme {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": types.MeDocument,
    "\n\tquery InstanceInformation {\n\t\tinstanceInformation {\n\t\t\tbackendVersion\n\t\t\tpythonVersion\n\t\t\tplatform\n\t\t}\n\t}\n": types.InstanceInformationDocument,
    "\n\tquery InstanceStatistics {\n\t\tinstanceStatistics {\n\t\t\ttotalFiles\n\t\t\tactiveFiles\n\t\t\texpiredFiles\n\t\t\ttotalStorageUsed\n\t\t\ttotalUsers\n\t\t}\n\t}\n": types.InstanceStatisticsDocument,
    "\n\tquery FileInfo($slug: String!) {\n\t\tfileInfo(key: $slug) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n": types.FileInfoDocument,
    "\n\tquery AdminFiles($page: Int, $size: Int, $search: String) {\n\t\tadminFiles(page: $page, size: $size, search: $search) {\n\t\t\titems {\n\t\t\t\tid\n\t\t\t\tkey\n\t\t\t\tfilename\n\t\t\t\tsize\n\t\t\t\tnumberOfFiles\n\t\t\t\tdownloadCount\n\t\t\t\tcreatedAt\n\t\t\t\texpiresAt\n\t\t\t\texpireAfterNDownload\n\t\t\t\tisExpired\n\t\t\t}\n\t\t\ttotal\n\t\t\tpage\n\t\t\tsize\n\t\t\tpages\n\t\t}\n\t}\n": types.AdminFilesDocument,
    "\n\tquery Users {\n\t\tusers {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": types.UsersDocument,
    "\n\tmutation Login($username: String!, $password: String!) {\n\t\tlogin(username: $username, password: $password) {\n\t\t\taccess\n\t\t\trefresh\n\t\t}\n\t}\n": types.LoginDocument,
    "\n\tmutation Logout {\n\t\tlogout\n\t}\n": types.LogoutDocument,
    "\n\tmutation UploadFile(\n\t\t$file: Upload!\n\t\t$filename: String!\n\t\t$expiresAt: Int!\n\t\t$expireAfterNDownload: Int!\n\t\t$numberOfFiles: Int\n\t) {\n\t\tuploadFile(\n\t\t\tfile: $file\n\t\t\tfilename: $filename\n\t\t\texpiresAt: $expiresAt\n\t\t\texpireAfterNDownload: $expireAfterNDownload\n\t\t\tnumberOfFiles: $numberOfFiles\n\t\t) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n": types.UploadFileDocument,
    "\n\tmutation CompleteOnboarding(\n\t\t$username: String!\n\t\t$email: String!\n\t\t$password: String!\n\t\t$siteDescription: String!\n\t) {\n\t\tcompleteOnboarding(\n\t\t\tusername: $username\n\t\t\temail: $email\n\t\t\tpassword: $password\n\t\t\tsiteDescription: $siteDescription\n\t\t) {\n\t\t\taccess\n\t\t\trefresh\n\t\t\tonboarded\n\t\t}\n\t}\n": types.CompleteOnboardingDocument,
    "\n\tmutation DeleteFile($fileId: ID!) {\n\t\tdeleteFile(fileId: $fileId)\n\t}\n": types.DeleteFileDocument,
    "\n\tmutation CreateUser($username: String!, $password: String!, $email: String) {\n\t\tcreateUser(username: $username, password: $password, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": types.CreateUserDocument,
    "\n\tmutation UpdateUser($userId: ID!, $username: String, $email: String) {\n\t\tupdateUser(userId: $userId, username: $username, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n": types.UpdateUserDocument,
    "\n\tmutation DeleteUser($userId: ID!) {\n\t\tdeleteUser(userId: $userId)\n\t}\n": types.DeleteUserDocument,
    "\n\tmutation UpdateConfig(\n\t\t$totalStorageLimit: Int\n\t\t$maxFileSizeLimit: Int\n\t\t$defaultExpiry: Int\n\t\t$defaultNumberOfDownloads: Int\n\t\t$siteDescription: String\n\t\t$allowUploads: Boolean\n\t) {\n\t\tupdateConfig(\n\t\t\ttotalStorageLimit: $totalStorageLimit\n\t\t\tmaxFileSizeLimit: $maxFileSizeLimit\n\t\t\tdefaultExpiry: $defaultExpiry\n\t\t\tdefaultNumberOfDownloads: $defaultNumberOfDownloads\n\t\t\tsiteDescription: $siteDescription\n\t\t\tallowUploads: $allowUploads\n\t\t) {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n": types.UpdateConfigDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery Config {\n\t\tconfig {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery Config {\n\t\tconfig {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery Onboarding {\n\t\tonboarding {\n\t\t\tisConfigured\n\t\t\thasUsers\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery Onboarding {\n\t\tonboarding {\n\t\t\tisConfigured\n\t\t\thasUsers\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery Me {\n\t\tme {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery Me {\n\t\tme {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery InstanceInformation {\n\t\tinstanceInformation {\n\t\t\tbackendVersion\n\t\t\tpythonVersion\n\t\t\tplatform\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery InstanceInformation {\n\t\tinstanceInformation {\n\t\t\tbackendVersion\n\t\t\tpythonVersion\n\t\t\tplatform\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery InstanceStatistics {\n\t\tinstanceStatistics {\n\t\t\ttotalFiles\n\t\t\tactiveFiles\n\t\t\texpiredFiles\n\t\t\ttotalStorageUsed\n\t\t\ttotalUsers\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery InstanceStatistics {\n\t\tinstanceStatistics {\n\t\t\ttotalFiles\n\t\t\tactiveFiles\n\t\t\texpiredFiles\n\t\t\ttotalStorageUsed\n\t\t\ttotalUsers\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery FileInfo($slug: String!) {\n\t\tfileInfo(key: $slug) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery FileInfo($slug: String!) {\n\t\tfileInfo(key: $slug) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery AdminFiles($page: Int, $size: Int, $search: String) {\n\t\tadminFiles(page: $page, size: $size, search: $search) {\n\t\t\titems {\n\t\t\t\tid\n\t\t\t\tkey\n\t\t\t\tfilename\n\t\t\t\tsize\n\t\t\t\tnumberOfFiles\n\t\t\t\tdownloadCount\n\t\t\t\tcreatedAt\n\t\t\t\texpiresAt\n\t\t\t\texpireAfterNDownload\n\t\t\t\tisExpired\n\t\t\t}\n\t\t\ttotal\n\t\t\tpage\n\t\t\tsize\n\t\t\tpages\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery AdminFiles($page: Int, $size: Int, $search: String) {\n\t\tadminFiles(page: $page, size: $size, search: $search) {\n\t\t\titems {\n\t\t\t\tid\n\t\t\t\tkey\n\t\t\t\tfilename\n\t\t\t\tsize\n\t\t\t\tnumberOfFiles\n\t\t\t\tdownloadCount\n\t\t\t\tcreatedAt\n\t\t\t\texpiresAt\n\t\t\t\texpireAfterNDownload\n\t\t\t\tisExpired\n\t\t\t}\n\t\t\ttotal\n\t\t\tpage\n\t\t\tsize\n\t\t\tpages\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tquery Users {\n\t\tusers {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"): (typeof documents)["\n\tquery Users {\n\t\tusers {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation Login($username: String!, $password: String!) {\n\t\tlogin(username: $username, password: $password) {\n\t\t\taccess\n\t\t\trefresh\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation Login($username: String!, $password: String!) {\n\t\tlogin(username: $username, password: $password) {\n\t\t\taccess\n\t\t\trefresh\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation Logout {\n\t\tlogout\n\t}\n"): (typeof documents)["\n\tmutation Logout {\n\t\tlogout\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation UploadFile(\n\t\t$file: Upload!\n\t\t$filename: String!\n\t\t$expiresAt: Int!\n\t\t$expireAfterNDownload: Int!\n\t\t$numberOfFiles: Int\n\t) {\n\t\tuploadFile(\n\t\t\tfile: $file\n\t\t\tfilename: $filename\n\t\t\texpiresAt: $expiresAt\n\t\t\texpireAfterNDownload: $expireAfterNDownload\n\t\t\tnumberOfFiles: $numberOfFiles\n\t\t) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation UploadFile(\n\t\t$file: Upload!\n\t\t$filename: String!\n\t\t$expiresAt: Int!\n\t\t$expireAfterNDownload: Int!\n\t\t$numberOfFiles: Int\n\t) {\n\t\tuploadFile(\n\t\t\tfile: $file\n\t\t\tfilename: $filename\n\t\t\texpiresAt: $expiresAt\n\t\t\texpireAfterNDownload: $expireAfterNDownload\n\t\t\tnumberOfFiles: $numberOfFiles\n\t\t) {\n\t\t\tid\n\t\t\tkey\n\t\t\tfilename\n\t\t\tsize\n\t\t\tnumberOfFiles\n\t\t\tdownloadCount\n\t\t\tcreatedAt\n\t\t\texpiresAt\n\t\t\texpireAfterNDownload\n\t\t\tisExpired\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation CompleteOnboarding(\n\t\t$username: String!\n\t\t$email: String!\n\t\t$password: String!\n\t\t$siteDescription: String!\n\t) {\n\t\tcompleteOnboarding(\n\t\t\tusername: $username\n\t\t\temail: $email\n\t\t\tpassword: $password\n\t\t\tsiteDescription: $siteDescription\n\t\t) {\n\t\t\taccess\n\t\t\trefresh\n\t\t\tonboarded\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation CompleteOnboarding(\n\t\t$username: String!\n\t\t$email: String!\n\t\t$password: String!\n\t\t$siteDescription: String!\n\t) {\n\t\tcompleteOnboarding(\n\t\t\tusername: $username\n\t\t\temail: $email\n\t\t\tpassword: $password\n\t\t\tsiteDescription: $siteDescription\n\t\t) {\n\t\t\taccess\n\t\t\trefresh\n\t\t\tonboarded\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation DeleteFile($fileId: ID!) {\n\t\tdeleteFile(fileId: $fileId)\n\t}\n"): (typeof documents)["\n\tmutation DeleteFile($fileId: ID!) {\n\t\tdeleteFile(fileId: $fileId)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation CreateUser($username: String!, $password: String!, $email: String) {\n\t\tcreateUser(username: $username, password: $password, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation CreateUser($username: String!, $password: String!, $email: String) {\n\t\tcreateUser(username: $username, password: $password, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation UpdateUser($userId: ID!, $username: String, $email: String) {\n\t\tupdateUser(userId: $userId, username: $username, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation UpdateUser($userId: ID!, $username: String, $email: String) {\n\t\tupdateUser(userId: $userId, username: $username, email: $email) {\n\t\t\tid\n\t\t\tusername\n\t\t\temail\n\t\t\tcreatedAt\n\t\t}\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation DeleteUser($userId: ID!) {\n\t\tdeleteUser(userId: $userId)\n\t}\n"): (typeof documents)["\n\tmutation DeleteUser($userId: ID!) {\n\t\tdeleteUser(userId: $userId)\n\t}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\tmutation UpdateConfig(\n\t\t$totalStorageLimit: Int\n\t\t$maxFileSizeLimit: Int\n\t\t$defaultExpiry: Int\n\t\t$defaultNumberOfDownloads: Int\n\t\t$siteDescription: String\n\t\t$allowUploads: Boolean\n\t) {\n\t\tupdateConfig(\n\t\t\ttotalStorageLimit: $totalStorageLimit\n\t\t\tmaxFileSizeLimit: $maxFileSizeLimit\n\t\t\tdefaultExpiry: $defaultExpiry\n\t\t\tdefaultNumberOfDownloads: $defaultNumberOfDownloads\n\t\t\tsiteDescription: $siteDescription\n\t\t\tallowUploads: $allowUploads\n\t\t) {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n"): (typeof documents)["\n\tmutation UpdateConfig(\n\t\t$totalStorageLimit: Int\n\t\t$maxFileSizeLimit: Int\n\t\t$defaultExpiry: Int\n\t\t$defaultNumberOfDownloads: Int\n\t\t$siteDescription: String\n\t\t$allowUploads: Boolean\n\t) {\n\t\tupdateConfig(\n\t\t\ttotalStorageLimit: $totalStorageLimit\n\t\t\tmaxFileSizeLimit: $maxFileSizeLimit\n\t\t\tdefaultExpiry: $defaultExpiry\n\t\t\tdefaultNumberOfDownloads: $defaultNumberOfDownloads\n\t\t\tsiteDescription: $siteDescription\n\t\t\tallowUploads: $allowUploads\n\t\t) {\n\t\t\ttotalStorageLimit\n\t\t\tmaxFileSizeLimit\n\t\t\tdefaultExpiry\n\t\t\tdefaultNumberOfDownloads\n\t\t\tsiteDescription\n\t\t\tdownloadConfigs\n\t\t\ttimeConfigs\n\t\t\tallowedFileTypes\n\t\t\tbannedFileTypes\n\t\t\tallowUploads\n\t\t}\n\t}\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;