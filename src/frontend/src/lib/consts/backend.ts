import { PUBLIC_BACKEND_API } from '$app/env/public';
import { strip_trailing_slash } from '#functions/urls';

// Throws at runtime if PUBLIC_BACKEND_API is not configured.
// The layout catches this and renders +error.svelte with a setup hint.
const root = strip_trailing_slash(PUBLIC_BACKEND_API);

/**
 * Single source of truth for the chithi backend API.
 * Mirrors the live routes on the Django + ninja backend.
 */
export class Api {
	static get BASE() {
		return root;
	}

	/** GraphQL endpoint. */
	static get GRAPHQL() {
		return `${root}/graphql/`;
	}

	/** Instance config (max size, expiry limits, etc). */
	static get CONFIG() {
		return `${root}/config/`;
	}

	/** Upload registration endpoint. */
	static get UPLOAD() {
		return `${root}/upload/`;
	}

	/** File metadata by key or UUID. */
	static FILE_INFO(fileKey: string) {
		return `${root}/files/${fileKey}/info/`;
	}

	/** Presigned / CDN URL for a single chunk. */
	static CHUNK_URL(fileKey: string, chunkIndex: number) {
		return `${root}/files/${fileKey}/chunk/${chunkIndex}/`;
	}

	/** Stream a single chunk's bytes through the backend. */
	static CHUNK_BYTES(fileKey: string, chunkIndex: number) {
		return `${root}/files/${fileKey}/chunk/${chunkIndex}/bytes/`;
	}

	/** Speedtest endpoints (standalone speedtest app, no ninja). */
	static get SPEEDTEST() {
		return {
			DOWNLOAD: `${root}/speedtest/download`,
			UPLOAD: `${root}/speedtest/upload`,
			LATENCY: `${root}/speedtest/latency`
		};
	}

	/**
	 * Reverse-share (P2P) signaling.
	 *
	 * The backend is a stateless relay: it stores no room records and no file
	 * bytes. It only joins sockets into a Channels group keyed by room id,
	 * forwards JSON between members, and streams a stored file's bytes on
	 * ``request_file``. The host owns the room and drives every message over
	 * this WebSocket.
	 */
	static get REVERSE() {
		const ws = (path: string, params?: Record<string, string>) => {
			const base = `${root}/${path}`.replace(/^http/, 'ws');
			const url = new URL(base);
			if (params) {
				for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
			}
			return url.href;
		};
		return {
			WS_URL: (id: string, token?: string) =>
				ws(`ws/reverse/rooms/${id}`, token ? { host_token: token } : undefined)
		};
	}

	/** App-state WebSocket URL (upload progress, space usage). */
	static get STATE_WS() {
		return `${root}/ws/state`.replace(/^http/, 'ws');
	}
}
