// Auto-generated GraphQL types from Django/Strawberry schema
export interface UserOut {
	id: string;
	username: string;
	email: string | null;
}

export interface LoginResult {
	access_token: string;
	token_type?: string;
}

export interface OnboardingStatus {
	onboarded: boolean;
}

export interface PaginationInfo {
	total_items: number;
	current_page: number;
	page_size: number;
	total_pages: number;
}

export interface FileOut {
	id: string;
	filename: string;
	size: number;
	expires_at: string;
	expire_after_n_download: number;
	download_count: number;
	created_at: string;
	is_expired: boolean;
	number_of_files: number | null;
}

export interface FileInfoOut {
	id: string;
	filename: string;
	size: number;
	download_count: number;
	created_at: string;
	expires_at: string;
	expire_after_n_download: number;
	number_of_files: number | null;
}

export interface PaginatedFilesOut {
	items: FileOut[];
	pagination: PaginationInfo;
}

export interface ConfigOut {
	id: string;
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
}

export interface InstanceInfoOut {
	python_version: string;
	django_version: string;
	redis_version: string | null;
	postgres_version: string | null;
	version: string;
	commit: string;
	is_release: boolean;
}

export interface InstanceStatisticsOut {
	total_bytes: number;
	total_files: number;
	total_downloads: number;
	active_urls: number;
	active_rooms: number;
	links_with_download_caps: number;
	expiring_soon: number;
	latest_expiry: number | null;
}

export interface RoomOut {
	id: string;
	name: string;
	created_at: string;
	expires_at: string;
	expire_after: number;
	number_of_downloads: number | null;
	files: RoomFileEntry[];
}

export interface RoomCreateResult {
	id: string;
	name: string;
	created_at: string;
	expires_at: string;
	expire_after: number;
	number_of_downloads: number | null;
	files: RoomFileEntry[];
	active_uploads_count: number;
	host_token: string;
}

export interface RoomFileEntry {
	key: string;
	filename: string;
	size: number;
	uploaded_at: string;
}

export interface HostTokenResult {
	host_token: string;
}

export interface DeleteResult {
	key: string;
	id: string;
}

export interface UploadResult {
	key: string;
}

export interface DownloadMeta {
	filename: string;
	size: number;
}

export interface LatencyResult {
	timestamp: number;
	latency_ms: number | null;
}

export interface UploadSpeedResult {
	bytes_received: number;
	timestamp: number;
}

export interface DownloadResult {
	download_url: string;
}

export interface AdminStatsOut {
	users: number;
	files: number;
	rooms: number;
	config_exists: boolean;
}
