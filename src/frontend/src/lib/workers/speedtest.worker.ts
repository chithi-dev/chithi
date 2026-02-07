self.onmessage = async (e: MessageEvent) => {
	const { type, baseUrl, duration = 10 } = e.data;
	if (type === 'start') {
		try {
			await runSpeedTest(baseUrl, duration);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			self.postMessage({ type: 'error', error: errorMessage });
		}
	}
};

async function runSpeedTest(baseUrl: string, duration: number) {
	// 1. DOWNLOAD
	self.postMessage({ type: 'phase', phase: 'download' });
	const downloadSpeed = await testDownload(baseUrl, duration);
	self.postMessage({ type: 'result', key: 'download', value: downloadSpeed });

	// Short pause
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// 2. UPLOAD
	self.postMessage({ type: 'phase', phase: 'upload' });
	const uploadSpeed = await testUpload(baseUrl, duration);
	self.postMessage({ type: 'result', key: 'upload', value: uploadSpeed });

	self.postMessage({ type: 'finish' });
}

async function testDownload(baseUrl: string, duration: number): Promise<number> {
	// 50MB chunk size request
	const size = 50 * 1024 * 1024;
	const endpoint = `${baseUrl}/speedtest/download?bytes=${size}`;

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

async function testUpload(baseUrl: string, duration: number): Promise<number> {
	const size = 20 * 1024 * 1024; // 20MB chunks
	const data = new Uint8Array(size);
	// Fill slightly to avoid compression optimization
	for (let i = 0; i < 1024; i++) data[i] = i % 255;

	let totalLoaded = 0;
	const startTime = performance.now();
	let lastUpdate = startTime;

	while ((performance.now() - startTime) / 1000 < duration) {
		await new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', `${baseUrl}/speedtest/upload`);

			let currentRequestLoaded = 0;

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					const now = performance.now();
					currentRequestLoaded = e.loaded;

					const elapsedTotal = (now - startTime) / 1000;

					if (elapsedTotal >= duration) {
						xhr.abort();
						return;
					}

					if (now - lastUpdate > 100) {
						if (elapsedTotal > 0) {
							const currentTotal = totalLoaded + e.loaded;
							const avgBps = (currentTotal * 8) / elapsedTotal;
							const avgMbps = avgBps / 1_000_000;

							self.postMessage({
								type: 'progress',
								phase: 'upload',
								speed: avgMbps,
								progress: Math.min(elapsedTotal / duration, 1)
							});
						}
						lastUpdate = now;
					}
				}
			};

			xhr.onload = () => {
				totalLoaded += size; // Add full size
				resolve();
			};

			xhr.onerror = () => {
				reject(new Error('Upload failed'));
			};

			xhr.onabort = () => {
				totalLoaded += currentRequestLoaded;
				resolve();
			};

			xhr.send(data);
		});
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
