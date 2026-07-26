import { gql } from '@apollo/client/core';

// ─── Queries ───────────────────────────────────────────────────────────────────

export const CONFIG_QUERY = gql`
	query Config {
		config {
			totalStorageLimit
			maxFileSizeLimit
			defaultExpiry
			defaultNumberOfDownloads
			siteDescription
			downloadConfigs
			timeConfigs
			allowedFileTypes
			bannedFileTypes
			allowUploads
		}
	}
`;

export const ONBOARDING_QUERY = gql`
	query Onboarding {
		onboarding {
			isConfigured
			hasUsers
		}
	}
`;

export const ME_QUERY = gql`
	query Me {
		me {
			id
			username
			email
			createdAt
		}
	}
`;

export const INSTANCE_INFO_QUERY = gql`
	query InstanceInformation {
		instanceInformation {
			backendVersion
			pythonVersion
			platform
		}
	}
`;

export const INSTANCE_STATS_QUERY = gql`
	query InstanceStatistics {
		instanceStatistics {
			totalFiles
			activeFiles
			expiredFiles
			totalStorageUsed
			totalUsers
		}
	}
`;

export const FILE_INFO_QUERY = gql`
	query FileInfo($slug: String!) {
		fileInfo(key: $slug) {
			id
			key
			filename
			size
			numberOfFiles
			downloadCount
			createdAt
			expiresAt
			expireAfterNDownload
			isExpired
		}
	}
`;

export const ADMIN_FILES_QUERY = gql`
	query AdminFiles($page: Int, $size: Int, $search: String) {
		adminFiles(page: $page, size: $size, search: $search) {
			items {
				id
				key
				filename
				size
				numberOfFiles
				downloadCount
				createdAt
				expiresAt
				expireAfterNDownload
				isExpired
			}
			total
			page
			size
			pages
		}
	}
`;

export const USERS_QUERY = gql`
	query Users {
		users {
			id
			username
			email
			createdAt
		}
	}
`;

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const LOGIN_MUTATION = gql`
	mutation Login($username: String!, $password: String!) {
		login(username: $username, password: $password) {
			access
			refresh
		}
	}
`;

export const LOGOUT_MUTATION = gql`
	mutation Logout {
		logout
	}
`;

export const UPLOAD_FILE_MUTATION = gql`
	mutation UploadFile(
		$file: Upload!
		$filename: String!
		$expiresAt: Int!
		$expireAfterNDownload: Int!
		$numberOfFiles: Int
	) {
		uploadFile(
			file: $file
			filename: $filename
			expiresAt: $expiresAt
			expireAfterNDownload: $expireAfterNDownload
			numberOfFiles: $numberOfFiles
		) {
			id
			key
			filename
			size
			numberOfFiles
			downloadCount
			createdAt
			expiresAt
			expireAfterNDownload
			isExpired
		}
	}
`;

export const COMPLETE_ONBOARDING_MUTATION = gql`
	mutation CompleteOnboarding(
		$username: String!
		$email: String!
		$password: String!
		$siteDescription: String!
	) {
		completeOnboarding(
			username: $username
			email: $email
			password: $password
			siteDescription: $siteDescription
		) {
			access
			refresh
			onboarded
		}
	}
`;

export const DELETE_FILE_MUTATION = gql`
	mutation DeleteFile($fileId: ID!) {
		deleteFile(fileId: $fileId)
	}
`;

export const CREATE_USER_MUTATION = gql`
	mutation CreateUser($username: String!, $password: String!, $email: String) {
		createUser(username: $username, password: $password, email: $email) {
			id
			username
			email
			createdAt
		}
	}
`;

export const UPDATE_USER_MUTATION = gql`
	mutation UpdateUser($userId: ID!, $username: String, $email: String) {
		updateUser(userId: $userId, username: $username, email: $email) {
			id
			username
			email
			createdAt
		}
	}
`;

export const DELETE_USER_MUTATION = gql`
	mutation DeleteUser($userId: ID!) {
		deleteUser(userId: $userId)
	}
`;

export const UPDATE_CONFIG_MUTATION = gql`
	mutation UpdateConfig(
		$totalStorageLimit: Int
		$maxFileSizeLimit: Int
		$defaultExpiry: Int
		$defaultNumberOfDownloads: Int
		$siteDescription: String
		$allowUploads: Boolean
	) {
		updateConfig(
			totalStorageLimit: $totalStorageLimit
			maxFileSizeLimit: $maxFileSizeLimit
			defaultExpiry: $defaultExpiry
			defaultNumberOfDownloads: $defaultNumberOfDownloads
			siteDescription: $siteDescription
			allowUploads: $allowUploads
		) {
			totalStorageLimit
			maxFileSizeLimit
			defaultExpiry
			defaultNumberOfDownloads
			siteDescription
			downloadConfigs
			timeConfigs
			allowedFileTypes
			bannedFileTypes
			allowUploads
		}
	}
`;
