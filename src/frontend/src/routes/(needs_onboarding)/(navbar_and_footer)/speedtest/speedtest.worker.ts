const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const getElapsedSeconds = (startTime: number) => (performance.now() - startTime) / 1_000;
const getMbps = (bytes: number, seconds: number) => (bytes * 8) / seconds / 1_000_000;
const reportProgress = (
	phase: 'latency' | 'download' | 'upload',
	value: number,
	progress: number
) => {
	self.postMessage({ type: 'progress', phase, speed: value, progress });
};

let endpoints: { DOWNLOAD: string; UPLOAD: string; LATENCY: string } | null = null;

self.addEventListener('message', async ({ data }: MessageEvent) => {
	const {
		type,
		duration = 10,
		urls
	} = data as {
		type: string;
		duration?: number;
		urls?: { DOWNLOAD: string; UPLOAD: string; LATENCY: string };
	};
	if (type !== 'start' || !urls) return;

	endpoints = urls;

	try {
		await runSpeedTest(duration);
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		self.postMessage({ type: 'error', error: errorMessage });
	}
});

const runSpeedTest = async (duration: number) => {
	self.postMessage({ type: 'phase', phase: 'latency' });
	const latency = await testLatency();
	self.postMessage({ type: 'result', key: 'latency', value: latency });

	await sleep(500);

	self.postMessage({ type: 'phase', phase: 'download' });
	const downloadSpeed = await testDownload(duration);
	self.postMessage({ type: 'result', key: 'download', value: downloadSpeed });

	await sleep(1_000);

	self.postMessage({ type: 'phase', phase: 'upload' });
	const uploadSpeed = await testUpload(duration);
	self.postMessage({ type: 'result', key: 'upload', value: uploadSpeed });

	self.postMessage({ type: 'finish' });
};

const testLatency = async (): Promise<number> => {
	const pings = 5;
	let totalLatency = 0;

	for (let i = 0; i < pings; i++) {
		const start = performance.now();
		try {
			await fetch(endpoints!.LATENCY, {
				cache: 'no-store'
			});
		} catch (e) {
			/* ignore errors for individual pings */
		}
		const elapsed = performance.now() - start;
		totalLatency += elapsed;
		reportProgress('latency', elapsed, (i + 1) / pings);
		await sleep(50);
	}

	const finalLatency = totalLatency / pings;
	reportProgress('latency', finalLatency, 1);
	return finalLatency;
};

const testDownload = async (duration: number): Promise<number> => {
	const size = 100 << 20; // 100MB for modern connections
	const endpoint = new URL(endpoints!.DOWNLOAD);
	endpoint.searchParams.set('bytes', size.toString());

	let totalBytes = 0;
	const startTime = performance.now();
	let lastReport = startTime;

	while (getElapsedSeconds(startTime) < duration) {
		const remainingMs = Math.max(0, duration * 1_000 - (performance.now() - startTime));
		const signal = AbortSignal.timeout(remainingMs);

		try {
			const response = await fetch(endpoint, { signal, cache: 'no-store' });
			if (!response.body) throw new Error('No response body');

			// ESNext: Async Iteration over ReadableStream
			for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
				totalBytes += chunk.byteLength;
				const elapsed = getElapsedSeconds(startTime);

				if (elapsed >= duration) break;

				if (performance.now() - lastReport > 100) {
					reportProgress('download', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
					lastReport = performance.now();
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'TimeoutError') {
				throw err;
			}
		}
	}

	const finalElapsed = Math.max(getElapsedSeconds(startTime), 0.001);
	const finalSpeed = getMbps(totalBytes, finalElapsed);
	reportProgress('download', finalSpeed, 1);

	return finalSpeed;
};

const testUpload = async (duration: number): Promise<number> => {
	let totalBytes = 0;
	const startTime = performance.now();
	let lastReport = startTime;

	// Use a large payload so XHR can track progress continuously over one connection
	const payloadSize = 50 * 1024 * 1024; // 50 MB
	const buffer = new Uint8Array(payloadSize);
	crypto.getRandomValues(buffer.subarray(0, 65536));
	const payload = new Blob([buffer], { type: 'application/octet-stream' });

	while (getElapsedSeconds(startTime) < duration) {
		await new Promise<void>((resolve) => {
			const xhr = new XMLHttpRequest();
			let lastLoaded = 0;

			xhr.upload.onprogress = (e) => {
				// Add only the new bytes uploaded since the last progress event
				const diff = e.loaded - lastLoaded;
				totalBytes += diff;
				lastLoaded = e.loaded;

				const elapsed = getElapsedSeconds(startTime);

				if (elapsed >= duration) {
					xhr.abort();
					return; // onabort will then handle resolving the promise
				}

				if (performance.now() - lastReport > 100) {
					reportProgress('upload', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
					lastReport = performance.now();
				}
			};

			xhr.onload = () => resolve();
			xhr.onerror = () => resolve();
			xhr.onabort = () => resolve();

			// Cache busting parameter to prevent any caching optimisations
			xhr.open('POST', `${endpoints!.UPLOAD}`, true);
			xhr.send(payload);
		});
	}

	const finalElapsed = Math.max(getElapsedSeconds(startTime), 0.001);
	const finalSpeed = getMbps(totalBytes, finalElapsed);
	reportProgress('upload', finalSpeed, 1);

	return finalSpeed;
};
