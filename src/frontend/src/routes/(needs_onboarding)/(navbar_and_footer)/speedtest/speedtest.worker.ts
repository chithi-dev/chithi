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
	const size = 50 << 20;
	const endpoint = new URL(endpoints!.DOWNLOAD);
	endpoint.searchParams.set('bytes', size.toString());

	let totalBytes = 0;
	const startTime = performance.now();
	let lastReport = startTime;

	while (getElapsedSeconds(startTime) < duration) {
		const remainingMs = Math.max(0, duration * 1_000 - (performance.now() - startTime));
		const signal = AbortSignal.timeout(remainingMs);

		try {
			const response = await fetch(endpoint, { signal });
			if (!response.body) throw new Error('No response body');

			const reader = response.body.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done || !value) break;

				totalBytes += value.length;
				const elapsed = getElapsedSeconds(startTime);

				if (elapsed >= duration) {
					await reader.cancel();
					break;
				}

				if (performance.now() - lastReport > 100) {
					reportProgress('download', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
					lastReport = performance.now();
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== 'AbortError') {
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
	const size = 20 << 20;
	const data = new Uint8Array(size);
	const chunkSize = 65536;
	for (let i = 0; i < size; i += chunkSize) {
		const chunk = new Uint8Array(Math.min(chunkSize, size - i));
		crypto.getRandomValues(chunk);
		data.set(chunk, i);
	}

	let totalBytes = 0;
	const startTime = performance.now();

	while (getElapsedSeconds(startTime) < duration) {
		let uploadedBytes = 0;
		const remainingMs = Math.max(0, duration * 1_000 - (performance.now() - startTime));
		const signal = AbortSignal.timeout(remainingMs);

		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (uploadedBytes >= size) {
					controller.close();
					return;
				}

				const chunkSize = 256 << 10;
				const next = Math.min(uploadedBytes + chunkSize, size);
				controller.enqueue(data.subarray(uploadedBytes, next));
				uploadedBytes = next;
			},
			cancel() {
				/* no-op */
			}
		});

		const progressTimer = setInterval(() => {
			const elapsed = getElapsedSeconds(startTime);
			if (elapsed <= 0) return;
			reportProgress(
				'upload',
				getMbps(totalBytes + uploadedBytes, elapsed),
				Math.min(elapsed / duration, 1)
			);
		}, 100);

		try {
			await fetch(endpoints!.UPLOAD, {
				method: 'POST',
				body: stream,
				signal
			});
			totalBytes += uploadedBytes;
		} catch (error: unknown) {
			if (error instanceof Error && error.name !== 'AbortError') {
				throw error;
			}
			totalBytes += uploadedBytes;
		} finally {
			clearInterval(progressTimer);
		}
	}

	const finalElapsed = Math.max(getElapsedSeconds(startTime), 0.001);
	const finalSpeed = getMbps(totalBytes, finalElapsed);
	reportProgress('upload', finalSpeed, 1);

	return finalSpeed;
};
