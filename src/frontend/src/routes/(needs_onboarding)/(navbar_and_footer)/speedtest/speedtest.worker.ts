import { Api } from '#consts/backend';

self.onmessage = async (e: MessageEvent) => {
	const { type, duration = 10 } = e.data;
	if (type === 'start') {
		try {
			await runSpeedTest(duration);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			self.postMessage({ type: 'error', error: errorMessage });
		}
	}
};

async function runSpeedTest(duration: number) {
	//  DOWNLOAD
	self.postMessage({ type: 'phase', phase: 'download' });
	const downloadSpeed = await testDownload(duration);
	self.postMessage({ type: 'result', key: 'download', value: downloadSpeed });

	// Short pause
	await new Promise((resolve) => setTimeout(resolve, 1000));

	//  UPLOAD
	self.postMessage({ type: 'phase', phase: 'upload' });
	const uploadSpeed = await testUpload(duration);
	self.postMessage({ type: 'result', key: 'upload', value: uploadSpeed });

	self.postMessage({ type: 'finish' });
}

async function testDownload(duration: number): Promise<number> {
	// 50MB chunk size request
	const size = 50 * 1024 * 1024;
	const endpoint = Api.SPEEDTEST.DOWNLOAD(size);

	let totalLoaded = 0;
	const startTime = performance.now();
	let lastUpdate = startTime;

	// Loop until duration passed
	while ((performance.now() - startTime) / 1000 < duration) {
		const controller = new AbortController();
		const signal = controller.signal;

		try {
			const response = await fetch(endpoint, { signal });
			if (!response.body) throw new Error('No response body');

			const reader = response.body.getReader();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				totalLoaded += value.length;
				const now = performance.now();
				const elapsedTotal = (now - startTime) / 1000;

				// Check time limit
				if (elapsedTotal >= duration) {
					await reader.cancel();
					controller.abort();
					break;
				}

				// Update progress every 100ms
				if (now - lastUpdate > 100) {
					if (elapsedTotal > 0) {
						const avgBps = (totalLoaded * 8) / elapsedTotal;
						const avgMbps = avgBps / 1_000_000;

						self.postMessage({
							type: 'progress',
							phase: 'download',
							speed: avgMbps,
							progress: Math.min(elapsedTotal / duration, 1)
						});
					}
					lastUpdate = now;
				}
			}
		} catch (e) {
			// Ignore abort errors
			if (e instanceof Error && e.name !== 'AbortError') {
				// console.error(e);
			}
		}
	}

	const finalDuration = (performance.now() - startTime) / 1000;
	// Calculate final speed
	const finalBps = (totalLoaded * 8) / finalDuration;
	const finalMbps = finalBps / 1_000_000;

	// Final update
	self.postMessage({
		type: 'progress',
		phase: 'download',
		speed: finalMbps,
		progress: 1
	});

	return finalMbps;
}

async function testUpload(duration: number): Promise<number> {
	const size = 20 * 1024 * 1024; // 20MB chunks
	const data = new Uint8Array(size);
	// Fill slightly to avoid compression optimization
	for (let i = 0; i < 1024; i++) data[i] = i % 255;

	let totalLoaded = 0;
	const startTime = performance.now();
	let lastUpdate = startTime;

	while ((performance.now() - startTime) / 1000 < duration) {
		const controller = new AbortController();
		const signal = controller.signal;
		let uploadedBytes = 0;

		const stream = new ReadableStream<Uint8Array>({
			pull: (controller) => {
				if (signal.aborted) {
					controller.close();
					return;
				}

				if (uploadedBytes >= size) {
					controller.close();
					return;
				}

				const chunkSize = 256 * 1024;
				const next = Math.min(uploadedBytes + chunkSize, size);
				controller.enqueue(data.subarray(uploadedBytes, next));
				uploadedBytes = next;
			},
			cancel: () => {
				// noop
			}
		});

		const timeout = setTimeout(
			() => controller.abort(),
			Math.max(0, duration * 1000 - (performance.now() - startTime))
		);
		const progressTimer = setInterval(() => {
			const now = performance.now();
			const elapsedTotal = (now - startTime) / 1000;
			if (elapsedTotal <= 0) return;

			const currentTotal = totalLoaded + uploadedBytes;
			const avgBps = (currentTotal * 8) / elapsedTotal;
			const avgMbps = avgBps / 1_000_000;

			self.postMessage({
				type: 'progress',
				phase: 'upload',
				speed: avgMbps,
				progress: Math.min(elapsedTotal / duration, 1)
			});
			lastUpdate = now;
		}, 100);

		try {
			await fetch(Api.SPEEDTEST.UPLOAD, {
				method: 'POST',
				body: stream,
				signal
			});
			totalLoaded += uploadedBytes;
		} catch (error: unknown) {
			if (error instanceof Error && error.name !== 'AbortError') {
				throw error;
			}
			totalLoaded += uploadedBytes;
		} finally {
			clearTimeout(timeout);
			clearInterval(progressTimer);
		}
	}

	const finalDuration = (performance.now() - startTime) / 1000;
	const finalBps = (totalLoaded * 8) / finalDuration;
	const finalMbps = finalBps / 1_000_000;

	// Final update
	self.postMessage({
		type: 'progress',
		phase: 'upload',
		speed: finalMbps,
		progress: 1
	});

	return finalMbps;
}
