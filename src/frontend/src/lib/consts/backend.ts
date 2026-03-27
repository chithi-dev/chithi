import { env } from '$env/dynamic/public';

/**
 * Single source of truth for the Backend API.
 * Uses the native URL API to handle slashes and protocols safely.
 */
export class Api {
	static #root = new URL(env.PUBLIC_BACKEND_API ?? 'http://localhost:8000/');

	/**
	 * Internal helper to build absolute URLs.
	 */
	static #url = (path: string) => new URL(path, this.#root).href;

	// --- Core Routes ---
	static get BASE() {
		return this.#root.href;
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
	static get TOKEN_VALIDATE() {
		return this.#url('token/validate');
	}
	static get UPLOAD() {
		return this.#url('upload');
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
				const ws = new URL(`ws/reverse/rooms/${id}`, this.#root);
				ws.protocol = this.#root.protocol === 'https:' ? 'wss:' : 'ws:';
				if (token) ws.searchParams.set('host_token', token);
				return ws.href;
			}
		};
	}
}
