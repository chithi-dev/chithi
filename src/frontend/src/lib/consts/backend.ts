import { strip_trailing_slash } from '#functions/urls';
import { env } from '$env/dynamic/public';

const environment_variable = env.PUBLIC_BACKEND_API ?? 'http://localhost:8000';
const normalized_env = strip_trailing_slash(environment_variable);

/**
 * Single source of truth for the Backend API.
 * Uses string templates for reliable path joining and the URL API for complex transformations.
 */
export class Api {
	static #root = normalized_env;

	/**
	 * Internal helper to build absolute HTTP URLs.
	 */
	static #url = (path: string) => `${this.#root}/${path}`;

	/**
	 * Internal helper to build absolute WebSocket URLs.
	 */
	static #ws = (path: string) => {
		const url = this.#url(path).replace(/^http/, 'ws');
		return new URL(url);
	};

	// --- Core Routes ---
	static get BASE() {
		return this.#root;
	}
	static get LOGIN() {
		return this.#url('login');
	}
	static get USER() {
		return this.#url('user');
	}
	static get CONFIG() {
		return this.#url('config');
	}
	static get ONBOARDING() {
		return this.#url('onboarding');
	}

	static get UPLOAD() {
		return this.#url('upload');
	}

	/**
	 * App state WebSocket URL.
	 */
	static get STATE_WS() {
		return this.#ws('ws/state').href;
	}

	// --- Parameterized Routes ---
	static FILE_INFO(slug: string) {
		return this.#url(`information/${slug}`);
	}
	static DOWNLOAD(slug: string) {
		return this.#url(`download/${slug}`);
	}

	// --- Admin Namespace ---
	static get ADMIN() {
		return {
			CONFIG: this.#url('admin/config'),
			USER_UPDATE: this.#url('admin/user'),
			FILES: this.#url('admin/files'),
			FILE_REVOKE: (id: string) => this.#url(`admin/files/${id}`)
		};
	}

	// --- Reverse Share Namespace ---
	static get REVERSE() {
		return {
			ROOMS: this.#url('reverse/rooms'),
			ROOM_DETAIL: (id: string) => this.#url(`reverse/rooms/${id}`),
			ROOM_UPLOAD: (id: string) => this.#url(`reverse/rooms/${id}/upload`),
			ROOM_HOSTS: (id: string) => this.#url(`reverse/rooms/${id}/hosts`),

			/**
			 * Builds a WebSocket URL for a room.
			 */
			WS_URL: (id: string, token?: string) => {
				const ws = this.#ws(`ws/reverse/rooms/${id}`);
				if (token) ws.searchParams.set('host_token', token);
				return ws.href;
			}
		};
	}

	static get SPEEDTEST() {
		return {
			DOWNLOAD: this.#url('speedtest/download'),
			UPLOAD: this.#url('speedtest/upload'),
			LATENCY: this.#url('speedtest/latency')
		};
	}
}
