import { Api } from '#consts/backend';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const getElapsedSeconds = (startTime: number) => (performance.now() - startTime) / 1_000;
const getMbps = (bytes: number, seconds: number) => (bytes * 8) / seconds / 1_000_000;
const reportProgress = (phase: 'download' | 'upload', speed: number, progress: number) => {
	self.postMessage({ type: 'progress', phase, speed, progress });
};

self.addEventListener('message', async ({ data }: MessageEvent) => {
	const { type, duration = 10 } = data as { type: string; duration?: number };
	if (type !== 'start') return;

	try {
		await runSpeedTest(duration);
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		self.postMessage({ type: 'error', error: errorMessage });
	}
});

const runSpeedTest = async (duration: number) => {
	self.postMessage({ type: 'phase', phase: 'download' });
	const downloadSpeed = await testDownload(duration);
	self.postMessage({ type: 'result', key: 'download', value: downloadSpeed });

	await sleep(1_000);

	self.postMessage({ type: 'phase', phase: 'upload' });
	const uploadSpeed = await testUpload(duration);
	self.postMessage({ type: 'result', key: 'upload', value: uploadSpeed });

	self.postMessage({ type: 'finish' });
};

const testDownload = async (duration: number): Promise<number> => {
	const size = 50 << 20;
	const endpoint = Api.SPEEDTEST.DOWNLOAD(size);

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
	const data = crypto.getRandomValues(new Uint8Array(size));

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
			await fetch(Api.SPEEDTEST.UPLOAD, {
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
