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

declare module 'heic2any' {
	type Heic2Any = (options: {
		blob: Blob;
		toType?: string;
		quality?: number;
	}) => Promise<Blob | Blob[]>;
	const heic2any: Heic2Any;
	export default heic2any;
}

export {};
