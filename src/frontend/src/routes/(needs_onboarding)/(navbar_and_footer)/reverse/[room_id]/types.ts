import type { Tween } from 'svelte/motion';

export interface RoomFileEntry {
	key: string;
	filename: string;
	size: number;
	uploaded_at: string;
	download_url: string;
}
export interface ActiveUpload {
	upload_key: string;
	filename: string;
	size: number;
	uploaded_bytes: number;
}
export interface RoomOut {
	id: string;
	name: string;
	expires_at: string;
	files: RoomFileEntry[];
	active_uploads: ActiveUpload[];
	host_count: number;
	connected_hosts: number;
	connected_guests: number;
}

export type ReceiveState =
	| { type: 'idle' }
	| {
			type: 'streaming';
			key: string;
			filename: string;
			size: number;
			received: number;
			chunks: BlobPart[];
	  }
	| {
			type: 'processing';
			key: string;
			filename: string;
			size: number;
	  };

export interface DownloadedFile {
	key: string;
	filename: string;
	size: number;
	objectUrl?: string;
}

export interface RemoteUpload {
	key: string;
	filename: string;
	size: number;
	uploadedBytes: number;
	progress: Tween<number>;
}

export interface UploadEntry {
	file: File;
	progress: Tween<number>;
	status: 'pending' | 'uploading' | 'done' | 'error';
	entry?: RoomFileEntry;
}
