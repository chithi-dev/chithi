// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			/**
			 * The resolved session, populated by `hooks.server.ts` from the
			 * `access_token` HttpOnly cookie. `null` when the user is not
			 * signed in.
			 */
			session: { token: string } | null;
		}
		interface PageData {
			/** The server-resolved auth session, or null when signed out. */
			session: { token: string } | null;
		}
		// interface PageState {}
		// interface Platform {}
	}

	// Build-time globals (available at runtime via Vite define)
	declare const __APP_VERSION__: string;
	declare const __COMMIT_SHA__: string;
}

declare module '*.wasm?url' {
	const url: string;
	export default url;
}

export {};
