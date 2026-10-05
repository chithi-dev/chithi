import { gql } from 'graphql-tag';

// ── Queries ──────────────────────────────────────────────────────────────

export const ConfigDocument = gql`
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

export const OnboardingDocument = gql`
	query Onboarding {
		onboarding {
			isConfigured
			hasUsers
		}
	}
`;

export const MeDocument = gql`
	query Me {
		me {
			id
			username
			email
			createdAt
		}
	}
`;

export const InstanceInformationDocument = gql`
	query InstanceInformation {
		instanceInformation {
			backendVersion
			pythonVersion
			platform
		}
	}
`;

export const InstanceStatisticsDocument = gql`
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

export const FileInfoDocument = gql`
	query FileInfo($slug: String!) {
		fileInfo(key: $slug) {
			id
			key
			filename
			size
			chunkCount
			numberOfFiles
			downloadCount
			createdAt
			expiresAt
			expireAfterNDownload
			isExpired
		}
	}
`;

export const AdminFilesDocument = gql`
	query AdminFiles($page: Int, $size: Int, $search: String) {
		adminFiles(page: $page, size: $size, search: $search) {
			items {
				id
				key
				filename
				size
				chunkCount
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

export const UsersDocument = gql`
	query Users {
		users {
			id
			username
			email
			createdAt
		}
	}
`;

// ── Mutations ────────────────────────────────────────────────────────────

export const LoginDocument = gql`
	mutation Login($username: String!, $password: String!) {
		login(username: $username, password: $password) {
			access
			refresh
		}
	}
`;

export const LogoutDocument = gql`
	mutation Logout {
		logout
	}
`;

// ── Chunked upload flow ─────────────────────────────────────────────────

export const RegisterFileDocument = gql`
	mutation RegisterFile(
		$filename: String!
		$totalSize: Int!
		$chunkCount: Int!
		$expiresAt: Int!
		$expireAfterNDownload: Int!
		$numberOfFiles: Int
	) {
		registerFile(
			filename: $filename
			totalSize: $totalSize
			chunkCount: $chunkCount
			expiresAt: $expiresAt
			expireAfterNDownload: $expireAfterNDownload
			numberOfFiles: $numberOfFiles
		) {
			id
			key
			filename
			size
			chunkCount
			numberOfFiles
			downloadCount
			createdAt
			expiresAt
			expireAfterNDownload
			isExpired
		}
	}
`;

export const UploadFileChunkDocument = gql`
	mutation UploadFileChunk($fileKey: String!, $chunkIndex: Int!, $chunk: Upload!, $isLast: Boolean!) {
		uploadFileChunk(fileKey: $fileKey, chunkIndex: $chunkIndex, chunk: $chunk, isLast: $isLast)
	}
`;

export const CompleteUploadDocument = gql`
	mutation CompleteUpload($fileId: ID!) {
		completeUpload(fileId: $fileId)
	}
`;

export const ChunkUrlDocument = gql`
	mutation ChunkUrl($fileId: ID!, $chunkIndex: Int!) {
		chunkUrl(fileId: $fileId, chunkIndex: $chunkIndex)
	}
`;

export const DeleteFileDocument = gql`
	mutation DeleteFile($fileId: ID!) {
		deleteFile(fileId: $fileId)
	}
`;

export const CreateUserDocument = gql`
	mutation CreateUser($username: String!, $password: String!, $email: String) {
		createUser(username: $username, password: $password, email: $email) {
			id
			username
			email
			createdAt
		}
	}
`;

export const UpdateUserDocument = gql`
	mutation UpdateUser($userId: ID!, $username: String, $email: String) {
		updateUser(userId: $userId, username: $username, email: $email) {
			id
			username
			email
			createdAt
		}
	}
`;

export const DeleteUserDocument = gql`
	mutation DeleteUser($userId: ID!) {
		deleteUser(userId: $userId)
	}
`;

export const UpdateConfigDocument = gql`
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

export const CompleteOnboardingDocument = gql`
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
