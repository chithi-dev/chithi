const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const getElapsedSeconds = (startTime: number) => (performance.now() - startTime) / 1_000;
const getMbps = (bytes: number, seconds: number) => (bytes * 8) / seconds / 1_000_000;

type Phase = 'latency' | 'download' | 'upload';
type EndpointConfig = { DOWNLOAD: string; UPLOAD: string; LATENCY: string };

const reportProgress = (phase: Phase, value: number, progress: number) =>
	self.postMessage({ type: 'progress' as const, phase, speed: value, progress });

let endpoints: EndpointConfig | null = null;

self.addEventListener('message', async ({ data }: MessageEvent<{ type: string; duration?: number; urls?: EndpointConfig }>) => {
	const { type, duration = 10, urls } = data;
	if (type !== 'start' || !urls) return;

	endpoints = urls;

	try {
		await runSpeedTest(duration);
	} catch (err) {
		self.postMessage({ type: 'error' as const, error: err instanceof Error ? err.message : String(err) });
	}
});

const runSpeedTest = async (duration: number) => {
	const phases: Phase[] = ['latency', 'download', 'upload'];
	for (let i = 0; i < phases.length; i++) {
		self.postMessage({ type: 'phase' as const, phase: phases[i] });

		switch (phases[i]) {
			case 'latency': {
				const value = await testLatency();
				self.postMessage({ type: 'result' as const, key: 'latency', value });
				break;
			}
			case 'download': {
				await sleep(500);
				const value = await testDownload(duration);
				self.postMessage({ type: 'result' as const, key: 'download', value });
				break;
			}
			case 'upload': {
				await sleep(1_000);
				const value = await testUpload(duration);
				self.postMessage({ type: 'result' as const, key: 'upload', value });
				break;
			}
		}
	}

	self.postMessage({ type: 'finish' as const });
};

const testLatency = async (): Promise<number> => {
	let totalLatency = 0;

	for (let i = 1; i <= 5; i++) {
		const start = performance.now();
		try {
			await fetch(endpoints!.LATENCY, { cache: 'no-store' });
		} catch {
			/* ignore */
		}
		totalLatency += performance.now() - start;
		reportProgress('latency', performance.now() - start, i / 5);
		await sleep(50);
	}

	const finalLatency = totalLatency / 5;
	reportProgress('latency', finalLatency, 1);
	return finalLatency;
};

const testDownload = async (duration: number): Promise<number> => {
	const size = 100 << 20; // 100MB
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

			for await (const value of response.body) {
				totalBytes += value.byteLength;
				const elapsed = getElapsedSeconds(startTime);

				if (elapsed >= duration) break;

				if (performance.now() - lastReport > 100) {
					reportProgress('download', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
					lastReport = performance.now();
				}
			}
		} catch (err) {
			if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'TimeoutError') throw err;
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

	// On iOS Safari, Web Workers have strict memory limits — use smaller payload to prevent Jetsam crashes.
	const payloadSize = 5 << 20; // 5 MB
	const buffer = new Uint8Array(payloadSize);
	crypto.getRandomValues(buffer.subarray(0, 65536));
	const payload = new Blob([buffer], { type: 'application/octet-stream' });

	while (getElapsedSeconds(startTime) < duration) {
		await new Promise<void>((resolve) => {
			const xhr = new XMLHttpRequest();
			let lastLoaded = 0;

			xhr.upload.onprogress = (e) => {
				totalBytes += e.loaded - lastLoaded;
				lastLoaded = e.loaded;
				const elapsed = getElapsedSeconds(startTime);

				if (elapsed >= duration) return xhr.abort();

				if (performance.now() - lastReport > 100) {
					reportProgress('upload', getMbps(totalBytes, elapsed), Math.min(elapsed / duration, 1));
					lastReport = performance.now();
				}
			};

			xhr.onload = xhr.onerror = xhr.onabort = () => resolve();
			xhr.open('POST', `${endpoints!.UPLOAD}`, true);
			xhr.send(payload);
		});
	}

	const finalElapsed = Math.max(getElapsedSeconds(startTime), 0.001);
	const finalSpeed = getMbps(totalBytes, finalElapsed);
	reportProgress('upload', finalSpeed, 1);

	return finalSpeed;
};
