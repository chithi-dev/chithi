// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Build-time globals (available at runtime via Vite define)
	declare const __APP_VERSION__: string;
	declare const __COMMIT_SHA__: string;
}

export {};
