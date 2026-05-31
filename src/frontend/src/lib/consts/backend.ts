import { strip_trailing_slash } from '#functions/urls';
import { env } from '$env/dynamic/public';

const environment_variable = env.PUBLIC_BACKEND_API ?? 'http://localhost:8000';
const normalized_env = strip_trailing_slash(environment_variable);

function url(path: string) {
	return `${normalized_env}/${path}`;
}

function ws(path: string) {
	const w = url(path).replace(/^http/, 'ws');
	return new URL(w);
}

/**
 * Single source of truth for the Backend API.
 * Uses string templates for reliable path joining and the URL API for complex transformations.
 */
export const Api = {
	// --- Core Routes ---
	get BASE() {
		return normalized_env;
	},
	get LOGIN() {
		return url('login');
	},
	get USER() {
		return url('user');
	},
	get CONFIG() {
		return url('config');
	},
	get ONBOARDING() {
		return url('onboarding');
	},
	get INSTANCE() {
		return url('instance/information');
	},
	get INSTANCE_STATISTICS() {
		return url('instance/statistics');
	},
	get UPLOAD() {
		return url('upload');
	},

	/**
	 * App state WebSocket URL.
	 */
	get STATE_WS() {
		return ws('ws/state').href;
	},

	// --- Parameterized Routes ---
	FILE_INFO: (slug: string) => url(`information/${slug}`),
	DOWNLOAD: (slug: string) => url(`download/${slug}`),

	// --- Admin Namespace ---
	get ADMIN() {
		return {
			get CONFIG() { return url('admin/config'); },
			get USER_UPDATE() { return url('admin/user'); },
			get USERS() { return url('admin/users'); },
			get USER_CREATE() { return url('admin/user'); },
			USER_DELETE: (id: string) => url(`admin/user/${id}`),
			get FILES() { return url('admin/files'); },
			FILE_REVOKE: (id: string) => url(`admin/files/${id}`)
		};
	},

	// --- Reverse Share Namespace ---
	get REVERSE() {
		return {
			get ROOMS() { return url('reverse/rooms'); },
			ROOM_DETAIL: (id: string) => url(`reverse/rooms/${id}`),
			ROOM_UPLOAD: (id: string) => url(`reverse/rooms/${id}/upload`),
			ROOM_HOSTS: (id: string) => url(`reverse/rooms/${id}/hosts`),

			/**
			 * Builds a WebSocket URL for a room.
			 */
			WS_URL: (id: string, token?: string) => {
				const w = ws(`ws/reverse/rooms/${id}`);
				if (token) w.searchParams.set('host_token', token);
				return w.href;
			}
		};
	},

	get SPEEDTEST() {
		return {
			get DOWNLOAD() { return url('speedtest/download'); },
			get UPLOAD() { return url('speedtest/upload'); },
			get LATENCY() { return url('speedtest/latency'); }
		};
	}
};