import { BACKEND_API } from '#consts/backend';

export interface ActiveUpload {
	upload_key: string;
	filename: string;
	uploaded_bytes: number;
	done: boolean;
}

export interface AppState {
	total_space_used: number;
	total_available_space: number | null;
	active_uploads: ActiveUpload[];
}

const DEFAULT_STATE: AppState = {
	total_space_used: 0,
	total_available_space: null,
	active_uploads: []
};

const RECONNECT_DELAY = 3000;

let state = $state<AppState>({ ...DEFAULT_STATE });
let connected = $state(false);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let refCount = 0;

function getWsUrl(): string {
	const base = BACKEND_API.replace(/^http/, 'ws');
	return `${base}/ws/state`;
}

function connect() {
	if (ws) return;

	try {
		ws = new WebSocket(getWsUrl());
	} catch {
		scheduleReconnect();
		return;
	}

	ws.onopen = () => {
		connected = true;
	};

	ws.onmessage = (event) => {
		try {
			const data: AppState = JSON.parse(event.data);
			state = data;
		} catch {
			// ignore malformed messages
		}
	};

	ws.onclose = () => {
		connected = false;
		ws = null;
		if (refCount > 0) scheduleReconnect();
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function scheduleReconnect() {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		if (refCount > 0) connect();
	}, RECONNECT_DELAY);
}

function disconnect() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (ws) {
		ws.onclose = null;
		ws.close();
		ws = null;
	}
	connected = false;
}

/** Call when a component mounts to subscribe to state. Returns an unsubscribe function. */
export function subscribeAppState(): () => void {
	refCount++;
	if (refCount === 1) connect();

	return () => {
		refCount--;
		if (refCount <= 0) {
			refCount = 0;
			disconnect();
		}
	};
}

export const appState = {
	get current() {
		return state;
	},
	get connected() {
		return connected;
	}
};
