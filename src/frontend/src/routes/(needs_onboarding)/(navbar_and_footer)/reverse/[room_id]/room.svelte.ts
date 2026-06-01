import { autoDownload } from '$lib/functions/browser-download';
import { Api } from '#consts/backend';
import { createDecryptedStream } from '#functions/streams';
import { toast } from 'svelte-sonner';
import { handleBinaryChunk } from './functions';
import type { DownloadedFile, ReceiveState, RemoteUpload, RoomFileEntry, RoomOut } from './types';

/**
 * Factory for shared reactive room state.
 * Used by both host and client components to eliminate duplication.
 *
 * State machine: idle → streaming → processing → idle (success/error)
 */
export function createRoomStore(opts: {
	room_id: () => string;
	room_key: () => string | null;
}) {
	// --- Reactive state ---
	let room = $state<RoomOut | null>(null);
	let loadStatus = $state<'loading' | 'error' | 'success'>('loading');
	let roomFiles = $state<RoomFileEntry[]>([]);
	let hostCount = $state(0);
	let connectedHosts = $state(0);
	let connectedGuests = $state(0);
	let receiveState = $state<ReceiveState>({ type: 'idle' });
	let downloadedFiles = $state<DownloadedFile[]>([]);
	let remoteUploads = $state<Map<string, RemoteUpload>>(new Map());
	let copiedFileKeys = $state<Set<string>>(new Set());
	let wsSend = $state<((data: Record<string, unknown>) => void) | undefined>(undefined);

	/** Current eager download target (client-only) */
	let eagerTarget = $state<string | null>(null);
	let downloadPreference = $state<'eager' | 'manual' | null>(null);

	// --- Derived ---
	let streamProgress = $derived.by(() => {
		const rs = receiveState;
		return rs.type === 'streaming' ? (rs.size > 0 ? (rs.received / rs.size) * 100 : 0) : 0;
	});

	let isAnyStreaming = $derived.by(() => receiveState.type !== 'idle');

	// --- Helpers ---
	const isDownloaded = (key: string) => downloadedFiles.some(f => f.key === key);

	/** Load room metadata from the API */
	const load = async (url = Api.REVERSE.ROOM_DETAIL(opts.room_id())) => {
		loadStatus = 'loading';
		try {
			const response = await fetch(url, { headers: { 'X-Room-Key': opts.room_key() ?? '' } });
			const data = (await response.json()) as RoomOut;
			room = data;
			roomFiles = data.files;
			hostCount = data.host_count;
			connectedHosts = data.connected_hosts;
			connectedGuests = data.connected_guests;
			loadStatus = 'success';
		} catch {
			loadStatus = 'error';
		}
	};

	/** Apply a room snapshot from the WebSocket */
	const onSnapshot = (snapshot: Record<string, unknown>) => {
		if ('files' in snapshot && Array.isArray(snapshot.files)) {
			roomFiles = snapshot.files as RoomFileEntry[];
		}
		if ('host_count' in snapshot) hostCount = snapshot.host_count as number;
		if ('connected_hosts' in snapshot) connectedHosts = snapshot.connected_hosts as number;
		if ('connected_guests' in snapshot) connectedGuests = snapshot.connected_guests as number;
	};

	/** Called when a file is added to the room */
	const onFileAdded = (file: RoomFileEntry) => {
		roomFiles = [...roomFiles, file];
	};

	/**
	 * Attempt to start receiving a file.
	 * Returns false if already receiving or file is already downloaded.
	 */
	const tryStartReceive = (key: string, filename: string, size: number) => {
		if (receiveState.type !== 'idle') return false;
		if (isDownloaded(key)) return false;
		receiveState = { type: 'streaming', key, filename, size, received: 0, chunks: [] };
		return true;
	};

	/** Handle file_end — decrypt if needed, create object URL, append to downloaded files */
	const onFileEnd = async () => {
		const rs = receiveState;
		if (rs.type !== 'streaming') return;

		const { key, filename, size, chunks } = rs;
		receiveState = { type: 'processing', key, filename, size };

		try {
			const rk = opts.room_key();
			const blob = rk
				? await new Response(
					(await createDecryptedStream(
						new ReadableStream({
							start(controller) {
								for (const chunk of chunks) controller.enqueue(chunk);
								controller.close();
							},
						}),
						rk,
						undefined,
						size
					)).stream
				).blob()
				: new Blob(chunks);

			const objectUrl = URL.createObjectURL(blob);
			downloadedFiles = [...downloadedFiles, { key, filename, size: blob.size, objectUrl }];

			if (eagerTarget === key) {
				eagerTarget = null;
				autoDownload(objectUrl, filename);
				toast.success('File decrypted and ready');
			}
		} catch {
			toast.error('Failed to process file');
			if (eagerTarget === key) eagerTarget = null;
		} finally {
			receiveState = { type: 'idle' };
		}
	};

	/** Reset receive state on error */
	const onFileError = () => {
		receiveState = { type: 'idle' };
		if (eagerTarget) eagerTarget = null;
		toast.error('File transfer failed');
	};

	/** Remove a file from both room and downloaded lists */
	const onFileRemoved = (key: string) => {
		roomFiles = roomFiles.filter(f => f.key !== key);
		downloadedFiles = downloadedFiles.filter(f => f.key !== key);
	};

	/** Handle room_destroyed — reset all state */
	const onRoomDestroyed = () => {
		room = null;
		roomFiles = [];
		hostCount = 0;
		cleanup();
	};

	/** Request a file download via WebSocket */
	const downloadFile = (file: RoomFileEntry) => {
		if (isDownloaded(file.key)) return;
		if (receiveState.type !== 'idle') return;
		if (!wsSend) return;

		receiveState = {
			type: 'streaming',
			key: file.key,
			filename: file.filename,
			size: file.size,
			received: 0,
			chunks: [],
		};

		wsSend({ type: 'download', key: file.key, filename: file.filename, size: file.size });
	};

	/** Copy file key to clipboard and track it */
	const copyFileKey = (key: string) => {
		navigator.clipboard.writeText(key);
		copiedFileKeys = new Set([...copiedFileKeys, key]);
	};

	/** Clear all copied-file tracking */
	const clearCopied = () => {
		copiedFileKeys = new Set();
	};

	/** Upload progress tracking */
	const onUploadStart = (upload: RemoteUpload) => {
		remoteUploads = new Map(remoteUploads).set(upload.key, upload);
	};

	const onUploadProgress = (upload_key: string, uploaded_bytes: number) => {
		const upload = remoteUploads.get(upload_key);
		if (upload) {
			upload.uploadedBytes = uploaded_bytes;
			upload.progress.set((upload.uploadedBytes / upload.size) * 100);
		}
	};

	const onUploadCancelled = (upload_key: string) => {
		remoteUploads = new Map(remoteUploads);
		remoteUploads.delete(upload_key);
	};

	/** Release all object URLs and reset receive state */
	const cleanup = () => {
		for (const df of downloadedFiles) {
			if (df.objectUrl) URL.revokeObjectURL(df.objectUrl);
		}
		downloadedFiles = [];
		receiveState = { type: 'idle' };
	};

	/** Set the eager download target (client-only) */
	const setEagerTarget = (key: string | null) => {
		eagerTarget = key;
	};

	/** Set download preference (client-only) */
	const setDownloadPreference = (pref: 'eager' | 'manual') => {
		downloadPreference = pref;
	};

	/** Check if eager download should accept the next file */
	const eagerAcceptNext = (key: string, filename: string, size: number) => {
		if (downloadPreference !== 'eager') return false;
		if (eagerTarget === null) return false;
		if (isDownloaded(key)) return false;
		eagerTarget = key;
		return tryStartReceive(key, filename, size);
	};

	/** Set the WebSocket send function (called after ws-reconnect initializes) */
	const setWsSend = (send: (data: Record<string, unknown>) => void) => {
		wsSend = send;
	};

	/** Whether there are undownloaded files available */
	const hasUndownloadedFiles = () => roomFiles.length > downloadedFiles.length;

	return {
		// Reactive getters
		getRoom: () => room,
		getLoadStatus: () => loadStatus,
		getRoomFiles: () => roomFiles,
		getHostCount: () => hostCount,
		getConnectedHosts: () => connectedHosts,
		getConnectedGuests: () => connectedGuests,
		getReceiveState: () => receiveState,
		getDownloadedFiles: () => downloadedFiles,
		getRemoteUploads: () => [...remoteUploads.values()],
		getCopiedFileKeys: () => copiedFileKeys,
		getStreamProgress: () => streamProgress,
		getIsAnyStreaming: () => isAnyStreaming,
		getEagerTarget: () => eagerTarget,
		getIsDecrypting: () => receiveState.type === 'processing',
		getDownloadPreference: () => downloadPreference,

		// Methods
		load,
		onSnapshot,
		onFileAdded,
		onFileEnd,
		onFileError,
		onFileRemoved,
		onRoomDestroyed,
		downloadFile,
		copyFileKey,
		clearCopied,
		onUploadStart,
		onUploadProgress,
		onUploadCancelled,
		cleanup,
		tryStartReceive,
		setEagerTarget,
		setDownloadPreference,
		eagerAcceptNext,
		setWsSend,
		hasUndownloadedFiles,
	};
}
