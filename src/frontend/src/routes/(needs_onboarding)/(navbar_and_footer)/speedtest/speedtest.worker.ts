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
	// Reusable 1MB chunk to eliminate aggressive memory allocations during high-speed tests
	const chunkSize = 1 << 20;
	const chunkData = new Uint8Array(chunkSize);
	for (let i = 0; i < chunkSize; i += 65536) {
		crypto.getRandomValues(chunkData.subarray(i, i + Math.min(65536, chunkSize - i)));
	}

	let totalBytes = 0;
	const startTime = performance.now();
	let lastReport = startTime;

	while (getElapsedSeconds(startTime) < duration) {
		const remainingMs = Math.max(0, duration * 1_000 - (performance.now() - startTime));
		const signal = AbortSignal.timeout(remainingMs);

		try {
			// Stream up to 250MB per single request connection to avoid TCP slow-start restarts
			const maxBytesPerRequest = 250 << 20;
			let bytesInCurrentRequest = 0;

			const stream = new ReadableStream({
				pull(controller) {
					const elapsed = getElapsedSeconds(startTime);
					if (elapsed >= duration || bytesInCurrentRequest >= maxBytesPerRequest) {
						controller.close();
						return;
					}

					// Enqueue the identical 1MB buffer. Supremely memory efficient and fast.
					controller.enqueue(chunkData);
					totalBytes += chunkSize;
					bytesInCurrentRequest += chunkSize;

					if (performance.now() - lastReport > 100) {
						reportProgress('upload', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
						lastReport = performance.now();
					}
				}
			});

			await fetch(endpoints!.UPLOAD, {
				method: 'POST',
				body: stream,
				// @ts-expect-error duplex is required when using a ReadableStream body in Fetch
				duplex: 'half',
				cache: 'no-store',
				signal
			});
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== 'TimeoutError' && err.name !== 'AbortError') {
				throw err;
			}
		}
	}

	const finalElapsed = Math.max(getElapsedSeconds(startTime), 0.001);
	const finalSpeed = getMbps(totalBytes, finalElapsed);
	reportProgress('upload', finalSpeed, 1);

	return finalSpeed;
};
