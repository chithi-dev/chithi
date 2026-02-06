/// <reference lib="webworker" />

self.onmessage = async (e: MessageEvent) => {
	const { type, baseUrl } = e.data;
	if (type === 'start') {
		try {
			await runSpeedTest(baseUrl);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			self.postMessage({ type: 'error', error: errorMessage });
		}
	}
};

async function runSpeedTest(baseUrl: string) {
	// 1. DOWNLOAD
	self.postMessage({ type: 'phase', phase: 'download' });
	const downloadSpeed = await testDownload(baseUrl);
	self.postMessage({ type: 'result', key: 'download', value: downloadSpeed });

	// Short pause
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// 2. UPLOAD
	self.postMessage({ type: 'phase', phase: 'upload' });
	const uploadSpeed = await testUpload(baseUrl);
	self.postMessage({ type: 'result', key: 'upload', value: uploadSpeed });

	self.postMessage({ type: 'finish' });
}

async function testDownload(baseUrl: string): Promise<number> {
	const size = 50 * 1024 * 1024; // 50MB
	const response = await fetch(`${baseUrl}/speedtest/download?bytes=${size}`);

	if (!response.body) {
		throw new Error('No response body');
	}

	const reader = response.body.getReader();
	let receivedLength = 0;
	const startTime = performance.now();
	let lastUpdate = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		receivedLength += value.length;

		const now = performance.now();
		// Update every 100ms max to avoid spamming main thread
		if (now - lastUpdate > 100) {
			const duration = (now - startTime) / 1000;
			// Avoid division by zero
			if (duration > 0) {
				const bps = (receivedLength * 8) / duration;
				const mbps = bps / 1_000_000;
				self.postMessage({
					type: 'progress',
					phase: 'download',
					speed: mbps,
					progress: receivedLength / size
				});
			}
			lastUpdate = now;
		}
	}

	const totalDuration = (performance.now() - startTime) / 1000;
	const finalBps = (receivedLength * 8) / totalDuration;
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

async function testUpload(baseUrl: string): Promise<number> {
	const size = 20 * 1024 * 1024; // 20MB
	// Create a buffer of random-ish data (or just zeros, backend doesn't check)
	const data = new Uint8Array(size);
	// Fill with some data to avoid potential compression/optimization issues in some network layers?
	// os.urandom in backend implies we should probably be robust, but simple 0 is fine for speed.
	// Let's fill first few bytes.
	for (let i = 0; i < 1024; i++) data[i] = i % 255;

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', `${baseUrl}/speedtest/upload`);

		const startTime = performance.now();
		let lastUpdate = 0;

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				const now = performance.now();
				if (now - lastUpdate > 100) {
					const duration = (now - startTime) / 1000;
					if (duration > 0) {
						const bps = (e.loaded * 8) / duration;
						const mbps = bps / 1_000_000;
						self.postMessage({
							type: 'progress',
							phase: 'upload',
							speed: mbps,
							progress: e.loaded / e.total
						});
					}
					lastUpdate = now;
				}
			}
		};

		xhr.onload = () => {
			const now = performance.now();
			const duration = (now - startTime) / 1000;
			const bps = (size * 8) / duration;
			const mbps = bps / 1_000_000;

			// Final update
			self.postMessage({
				type: 'progress',
				phase: 'upload',
				speed: mbps,
				progress: 1
			});

			resolve(mbps);
		};

		xhr.onerror = () => {
			reject(new Error('Upload failed'));
		};

		xhr.send(data);
	});
}
