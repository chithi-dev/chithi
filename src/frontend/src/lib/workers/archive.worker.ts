import JS7z from '../../vendor/js7z-mt-fs-ec/js7z.js';
// @ts-ignore
import wasmUrl from '../../vendor/js7z-mt-fs-ec/js7z.wasm?url';

const ctx: Worker = self as any;

// Global error handler to catch any uncaught errors in the worker
self.addEventListener('error', (e) => {
	console.error('Worker global error:', e.message, e.filename, e.lineno);
	ctx.postMessage({
		type: 'error',
		error: `Worker script error: ${e.message} at ${e.filename}:${e.lineno}`
	});
});

self.addEventListener('unhandledrejection', (e) => {
	console.error('Worker unhandled rejection:', e.reason);
	ctx.postMessage({
		type: 'error',
		error: `Worker unhandled rejection: ${e.reason}`
	});
});

ctx.onmessage = async (e) => {
	const { files } = e.data;

	console.log('Worker received message, files:', files?.length);
	console.log('WASM URL:', wasmUrl);

	// Check for SharedArrayBuffer support (required for multi-threaded JS7z)
	if (typeof SharedArrayBuffer === 'undefined') {
		ctx.postMessage({
			type: 'error',
			error:
				'SharedArrayBuffer is not available. The page needs Cross-Origin-Isolation headers (COOP/COEP) for 7z compression to work.'
		});
		return;
	}

	try {
		console.log('Initializing JS7z...');
		const js7z = await JS7z({
			locateFile: (path: string) => {
				console.log('locateFile called for:', path);
				if (path.endsWith('.wasm')) return wasmUrl;
				return path;
			},
			print: (text: string) => console.log('[7z]', text),
			printErr: (text: string) => console.error('[7z error]', text)
		});
		console.log('JS7z initialized successfully');

		// Mount WORKERFS
		// We need to create the directory first
		js7z.FS.mkdir('/in');
		js7z.FS.mount(js7z.WORKERFS, { files: files }, '/in');
		console.log('Mounted /in with', files.length, 'files');

		js7z.FS.mkdir('/out');

		// @ts-ignore
		(js7z as any).onExit = (code: number) => {
			console.log('7z exited with code:', code);
			if (code === 0) {
				try {
					const content = js7z.FS.readFile('/out/archive.7z');
					console.log('Archive created, size:', content.length);
					ctx.postMessage({ type: 'complete', data: content }, [content.buffer]);
				} catch (err) {
					ctx.postMessage({ type: 'error', error: 'Failed to read output file: ' + err });
				}
			} else {
				ctx.postMessage({ type: 'error', error: '7z exit code ' + code });
			}
		};

		// Run 7z
		// a: add
		// -t7z: 7z format (default, but good to be explicit)
		// -mx1: fastest compression (optional, but good for UX)
		// /out/archive.7z: output
		// /in/*: input
		// Note: callMain is async in some builds, but we rely on onExit callback
		console.log('Starting 7z compression...');
		js7z.callMain(['a', '-t7z', '-mx1', '/out/archive.7z', '/in/*']);
	} catch (err) {
		// If JS7z fails to initialize or throws synchronously
		console.error('Worker caught error:', err);
		const errorMessage = err instanceof Error ? err.message : String(err);
		ctx.postMessage({ type: 'error', error: 'Worker initialization error: ' + errorMessage });
	}
};
