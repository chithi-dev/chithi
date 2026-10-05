import { PUBLIC_BACKEND_API } from '$app/env/public';
import { strip_trailing_slash } from '#functions/urls';

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
	 * Reverse-share (P2P) routes -- the backend currently has no WebSocket
	 * support, so these are placeholder URLs kept only to keep the existing
	 * client code compiling. Remove once the feature is either implemented
	 * server-side or deleted from the frontend.
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
			ROOMS: `${root}/reverse/rooms`,
			ROOM_DETAIL: (id: string) => `${root}/reverse/rooms/${id}`,
			ROOM_UPLOAD: (id: string) => `${root}/reverse/rooms/${id}/upload`,
			ROOM_HOSTS: (id: string) => `${root}/reverse/rooms/${id}/hosts`,
			WS_URL: (id: string, token?: string) =>
				ws(`ws/reverse/rooms/${id}`, token ? { host_token: token } : undefined)
		};
	}

	/** App-state WebSocket URL (upload progress, space usage). */
	static get STATE_WS() {
		return `${root}/ws/state`.replace(/^http/, 'ws');
	}
}
