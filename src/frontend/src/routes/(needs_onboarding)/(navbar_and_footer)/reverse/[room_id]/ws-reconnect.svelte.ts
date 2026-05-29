import { cubicOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';
import { toast } from 'svelte-sonner';
import type { RoomFileEntry, ReceiveState, RemoteUpload } from './types';
import { Api } from '#consts/backend';
import { handle_binary_chunk } from './functions';

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30_000;

interface MessageHandler {
	onSnapshot?(room: Record<string, unknown>): void;
	onHostCount?(count: number): void;
	onConnectionCounts?(hosts: number, guests: number): void;
	onUploadStart?(entry: RemoteUpload): void;
	onUploadProgress?(upload_key: string, uploaded_bytes: number): void;
	onUploadCancelled?(upload_key: string): void;
	onFileAdded?(file: RoomFileEntry): void;
	onFileEnd?(key: string): void;
	onFileRemoved?(key: string): void;
	onRoomDestroyed?(): void;
	onFileError?(detail: string, key: string): void;
}

export function useWsReconnect(
	opts: {
		get_room_id: () => string;
		get_host_token: () => string | undefined;
		get_receive_state: () => ReceiveState;
		get_downloaded_files: () => Array<{ key: string }>;
		get_room_key: () => string | null;
	} & MessageHandler,
) {
	let ws: WebSocket | null = null;
	let connected = $state(false);
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let delay = INITIAL_DELAY;

	function getWsUrl() {
		return Api.REVERSE.WS_URL(opts.get_room_id(), opts.get_host_token());
	}

	function scheduleReconnect() {
		if (reconnectTimer || ws) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			delay = Math.min(delay * 1.8, MAX_DELAY);
			connect();
		}, delay);
	}

	function clearReconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		delay = INITIAL_DELAY;
	}

	function connect() {
		ws?.close();
		try {
			const socket = new WebSocket(getWsUrl());
			socket.binaryType = 'arraybuffer';
			ws = socket;
		} catch {
			scheduleReconnect();
			return;
		}

		ws.onopen = () => {
			connected = true;
			delay = INITIAL_DELAY;
		};

		ws.onclose = () => {
			connected = false;
			ws = null;
			scheduleReconnect();
		};

		ws.onerror = () => {
			connected = false;
			toast.error('WebSocket connection error');
		};

		ws.onmessage = (ev) => handleWsMessage(ev);
	}

	function handleWsMessage(ev: MessageEvent) {
		if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
			handle_binary_chunk({ receive_state: opts.get_receive_state(), data: ev.data });
			return;
		}

		let msg: Record<string, unknown>;
		try {
			msg = JSON.parse(ev.data);
		} catch {
			return;
		}

		const type = msg.type as string | undefined;
		switch (type) {
			case 'snapshot': {
				const room = msg.room as Record<string, unknown> | undefined;
				if (room?.files && Array.isArray(room.files)) {
					opts.onSnapshot?.(room);
				}
				break;
			}
			case 'host_count':
				if (typeof msg.count === 'number') opts.onHostCount?.(msg.count);
				break;
			case 'connection_counts': {
				const hosts = typeof msg.hosts === 'number' ? msg.hosts : undefined;
				const guests = typeof msg.guests === 'number' ? msg.guests : undefined;
				if (hosts !== undefined || guests !== undefined) opts.onConnectionCounts?.(hosts ?? 0, guests ?? 0);
				break;
			}
			case 'upload_start': {
				const key = msg.upload_key as string | undefined;
				const filename = msg.filename as string | undefined;
				const size = typeof msg.size === 'number' ? msg.size : 0;
				if (key && opts.onUploadStart) {
					opts.onUploadStart({
						key,
						filename: filename ?? '',
						size,
						uploadedBytes: 0,
						progress: new Tween(0, { duration: 300, easing: cubicOut })
					});
				}
				break;
			}
			case 'upload_progress': {
				const upload_key = msg.upload_key as string | undefined;
				const uploaded_bytes = typeof msg.uploaded_bytes === 'number' ? msg.uploaded_bytes : 0;
				if (upload_key) opts.onUploadProgress?.(upload_key, uploaded_bytes);
				break;
			}
			case 'upload_cancelled': {
				const key = msg.upload_key as string | undefined;
				if (key) opts.onUploadCancelled?.(key);
				break;
			}
			case 'file_added': {
				const file = msg.file as Record<string, unknown> | undefined;
				if (file && opts.onFileAdded) {
					opts.onFileAdded(file as unknown as RoomFileEntry);
				}
				break;
			}
			case 'file_start':
				// Handled by handle_binary_chunk via streaming state
				break;
			case 'file_end': {
				const key = msg.key as string | undefined;
				if (key) opts.onFileEnd?.(key);
				break;
			}
			case 'file_error': {
				const detail = typeof msg.detail === 'string' ? msg.detail : '';
				const key = msg.key as string | undefined;
				opts.onFileError?.(detail, key ?? '');
				break;
			}
			case 'file_removed': {
				const key = msg.key as string | undefined;
				if (key) opts.onFileRemoved?.(key);
				break;
			}
			case 'room_destroyed':
				opts.onRoomDestroyed?.();
				break;
		}
	}

	function send(data: Record<string, unknown>) {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(data));
		}
	}

	function close() {
		clearReconnect();
		if (ws) { ws.onclose = null; ws.close(); }
		ws = null;
	}

	// Auto-connect on initialization
	connect();

	return {
		get connected() {
			return connected;
		},
		send,
		close
	};
}
