<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Download, Link, Check, ArrowLeft, Copy, WandSparkles } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import CodeViewer from '$lib/components/CodeViewer.svelte';
	import { autoDownload } from '$lib/functions/browser-download';
	import { detectMimeFromBlob } from '$lib/functions/mime';
	import { getImageSupportInfo, type ImageSupportInfo } from '$lib/functions/media-support';
	import ConverterWorker from '$lib/workers/file-converter.worker?worker';

	interface Props {
		filename: string;
		contentText?: string | null;
		contentUrl?: string | null;
		onclose?: () => void;
		ondownload?: () => void;
		oncopylink?: () => void;
	}

	const { filename, contentText = null, contentUrl = null, onclose, ondownload, oncopylink }: Props = $props();

	/* --- Utility: one-shot flash --- */
	const createFlash = (duration = 2000) => {
		let active = $state(false);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const flash = () => {
			active = true;
			clearTimeout(timer);
			timer = setTimeout(() => (active = false), duration);
		};
		return { get active() { return active; }, flash };
	};

	const linkFlash = createFlash();
	const textFlash = createFlash();

	/* --- Derived basics --- */
	const baseName = $derived(filename.split(/[/\\]/).at(-1) ?? filename);

	const isUnopenable = $derived(
		[
			'.exe', '.bin', '.so', '.dll', '.msi', '.app', '.dmg', '.pkg', '.iso',
			'.vmdk', '.a', '.lib', '.obj', '.o', '.pyc', '.pyo', '.pyd', '.deb', '.rpm'
		].some((ext) => filename.toLowerCase().endsWith(ext))
	);

	/* --- Conversion type mapping --- */
	type ConversionType = 'heic' | 'svg' | 'jxl' | 'jxr' | 'qoi' | 'webp' | 'png' | 'gif';

	const mimeToType: Record<string, ConversionType> = {
		'image/heic': 'heic',
		'image/heif': 'heic',
		'image/svg+xml': 'svg',
		'image/jxl': 'jxl',
		'image/jxr': 'jxr',
		'image/qoi': 'qoi',
		'image/webp': 'webp',
		'image/png': 'png',
		'image/gif': 'gif'
	};

	const convertibleMimes = new Set(Object.keys(mimeToType));

	const conversionLabelMap: Record<ConversionType, string> = {
		heic: 'HEIC', svg: 'SVG', jxl: 'JXL', jxr: 'JXR',
		qoi: 'QOI', webp: 'WEBP', png: 'PNG', gif: 'GIF'
	};

	/* --- Sniffing state --- */
	type MediaKind = 'image' | 'video' | 'audio' | 'other';
	let sniffedKind = $state<MediaKind | null>(null);
	let sniffedMime = $state<string | null>(null);
	let imageSupport = $state<ImageSupportInfo | null>(null);
	let sourceBlob = $state<Blob | null>(null);

	const conversionType = $derived<ConversionType | null>(sniffedMime ? mimeToType[sniffedMime] ?? null : null);

	/* --- Conversion state (PNG preview) --- */
	let convertedBlob = $state<Blob | null>(null);
	let convertedUrl = $state<string | null>(null);
	let converting = $state(false);
	let conversionStarted = $state(false);
	let conversionError = $state<string | null>(null);
	let isOptimizing = $state(false);
	let conversionPromise: Promise<Blob | null> | null = null;

	/* --- GIF→WebP conversion state --- */
	let gifConverting = $state(false);
	let gifOptimizing = $state(false);
	let gifConversionPromise: Promise<Blob | null> | null = null;

	const resetConversionState = () => {
		conversionPromise = null;
		converting = false;
		conversionStarted = false;
		conversionError = null;
		convertedBlob = null;
		convertedUrl = null;
		sourceBlob = null;
		isOptimizing = false;
		gifConversionPromise = null;
		gifConverting = false;
		gifOptimizing = false;
	};

	/* --- Filename helpers --- */
	const specialExtensions = ['.heic', '.heif', '.jxr', '.wdp', '.hdp', '.qoi', '.webp'];

	const getPngFilename = (name: string) => {
		const lower = name.toLowerCase();
		const matched = specialExtensions.find((ext) => lower.endsWith(ext));
		if (matched) return `${name.slice(0, -matched.length)}.png`;
		if (lower.endsWith('.svg') || lower.endsWith('.jxl')) return `${name.slice(0, -4)}.png`;
		return `${name}.png`;
	};

	const getWebpFilename = (name: string) => {
		return name.toLowerCase().endsWith('.gif') ? `${name.slice(0, -4)}.webp` : `${name}.webp`;
	};

	/* --- Download helpers --- */
	const downloadBlob = (blob: Blob, name: string) => {
		const url = URL.createObjectURL(blob);
		autoDownload(url, name);
		URL.revokeObjectURL(url);
	};

	/* --- Generic worker conversion runner --- */
	const runConversion = (opts: {
		type: ConversionType;
		expectedMime: string;
		setOptimizing: (v: boolean) => void;
		onSuccess: (blob: Blob) => void;
		onError: () => void;
		blob?: Blob | null;
		text?: string | null;
		optimize?: boolean;
	}): Promise<Blob | null> => {
		const { type, expectedMime, setOptimizing, onSuccess, onError, blob, text, optimize = false } = opts;

		return new Promise<Blob | null>((resolve, reject) => {
			const worker = new ConverterWorker();

			worker.onmessage = (e) => {
				const { data } = e;

				if (data.type === 'status' && data.status === 'optimizing') {
					setOptimizing(true);
					return;
				}

				if (data.type === 'success') {
					if (!data.outputBlob || !(data.outputBlob instanceof Blob)) {
						reject(new Error('Worker returned invalid blob'));
						worker.terminate();
						return;
					}
					if ((data.outputMime ?? expectedMime) !== expectedMime) {
						reject(new Error('Worker returned unexpected output format'));
						worker.terminate();
						return;
					}
					onSuccess(data.outputBlob);
					resolve(data.outputBlob);
					worker.terminate();
				} else if (data.type === 'error') {
					onError();
					reject(new Error(data.message));
					worker.terminate();
				}
			};

			worker.onerror = () => {
				reject(new Error('Worker error'));
				worker.terminate();
			};

			worker.postMessage({ type, blob, text, optimize });
		});
	}

	/* --- PNG conversion (preview + download) --- */
	const startConversion = async (forceOptimize = false) => {
		if (!forceOptimize && convertedBlob) return convertedBlob;
		if (conversionPromise && !forceOptimize) return await conversionPromise;

		converting = true;
		conversionStarted = true;
		conversionError = null;
		isOptimizing = false;

		conversionPromise = (async () => {
			const type = conversionType;
			if (!type || type === 'gif') return null;

			let svgText: string | null = null;
			if (type === 'svg') {
				svgText = contentText ?? (contentUrl ? await fetch(contentUrl).then((r) => r.text()) : null);
			}

			try {
				return await runConversion({
					type,
					expectedMime: 'image/png',
					setOptimizing: (v) => (isOptimizing = v),
					onSuccess: (blob) => {
						convertedBlob = blob;
						convertedUrl = URL.createObjectURL(blob);
						conversionError = null;
						isOptimizing = false;
					},
					onError: () => {
						conversionError = `Could not convert this ${sniffedMime?.split('/')[1]?.toUpperCase()} image.`;
						isOptimizing = false;
					},
					blob: sourceBlob,
					text: svgText,
					optimize: forceOptimize
				});
			} catch {
				conversionError = `Could not convert this ${sniffedMime?.split('/')[1]?.toUpperCase()} image.`;
				isOptimizing = false;
				return null;
			} finally {
				converting = false;
				conversionPromise = null;
			}
		})();

		return await conversionPromise;
	};

	/* --- GIF → WebP conversion --- */
	const startGifToWebpConversion = async () => {
		if (gifConversionPromise) return await gifConversionPromise;
		if (!sourceBlob) return null;

		gifConverting = true;
		gifOptimizing = true;

		gifConversionPromise = runConversion({
			type: 'gif',
			expectedMime: 'image/webp',
			setOptimizing: (v) => (gifOptimizing = v),
			onSuccess: () => {},
			onError: () => {},
			blob: sourceBlob,
			optimize: true
		}).finally(() => {
			gifConverting = false;
			gifOptimizing = false;
			gifConversionPromise = null;
		});

		return await gifConversionPromise;
	};

	/* --- Download handlers --- */
	const handleDownloadOriginal = () => {
		ondownload?.();
		if (contentText !== null) downloadBlob(new Blob([contentText], { type: 'text/plain' }), baseName);
		else if (contentUrl) autoDownload(contentUrl, baseName);
	};

	const handleDownloadPng = async () => {
		const blob = await startConversion(false);
		blob && downloadBlob(blob, getPngFilename(baseName));
	};

	const handleOptimizePng = async () => {
		const blob = await startConversion(true);
		blob && downloadBlob(blob, getPngFilename(baseName));
	};

	const handleDownloadWebp = async () => {
		const blob = await startGifToWebpConversion();
		blob && downloadBlob(blob, getWebpFilename(baseName));
	};

	/* --- Sniff effect --- */
	$effect(() => {
		sniffedKind = null;
		sniffedMime = null;
		imageSupport = null;
		resetConversionState();
		if (!contentUrl || contentText !== null || isUnopenable) return;

		let cancelled = false;

		(async () => {
			try {
				const response = await fetch(contentUrl);
				const blob = await response.blob();
				const detectedMime = await detectMimeFromBlob(blob);
				const mime = detectedMime ?? (blob.type !== 'application/octet-stream' ? blob.type : null);

				const kind: MediaKind = mime?.startsWith('image/') ? 'image'
					: mime?.startsWith('video/') ? 'video'
					: mime?.startsWith('audio/') ? 'audio'
					: 'other';

				if (!cancelled) {
					sniffedMime = mime;
					sniffedKind = kind;
					if (mime && convertibleMimes.has(mime)) sourceBlob = blob;

					if (kind === 'image' && mime) {
						imageSupport = await getImageSupportInfo(mime);
					}
				}
			} catch {
				if (!cancelled) sniffedKind = 'other';
			}
		})();

		return () => (cancelled = true);
	});

	/* --- Cleanup converted URL --- */
	$effect(() => {
		const url = convertedUrl;
		return () => { if (url) URL.revokeObjectURL(url); };
	});

	/* --- Derived flags --- */
	const isConvertible = $derived(conversionType != null && conversionType !== 'gif');
	const isGif = $derived(conversionType === 'gif');
	const isImage = $derived(sniffedKind === 'image');
	const isVideo = $derived(sniffedKind === 'video');
	const isAudio = $derived(sniffedKind === 'audio');
	const isPending = $derived(sniffedKind === null);
	const isImageUnsupported = $derived(!isConvertible && imageSupport?.status === 'unsupported');
	const shouldAutoConvert = $derived(
		isConvertible || (conversionType === 'webp' && imageSupport?.status === 'unsupported')
	);

	const conversionFormatLabel = $derived(conversionType ? conversionLabelMap[conversionType] : 'PNG');

	type ImageInfo = { title: string; message?: string | null; mime?: string | null };

	const imageInfo = $derived<ImageInfo | null>(
		isConvertible && conversionStarted && !converting && !convertedUrl
			? { title: conversionError ?? `Unable to preview this ${sniffedMime?.split('/')[1]?.toUpperCase()} image.`, message: imageSupport?.message ?? null, mime: sniffedMime }
			: isImageUnsupported
				? { title: 'This image format is not supported in this browser.', message: imageSupport?.message ?? null, mime: sniffedMime }
				: null
	);

	/* --- Toolbar --- */
	type IconComponent = typeof Link;

	interface ToolbarAction {
		key: string;
		label: string;
		activeLabel?: string;
		icon: IconComponent;
		activeIcon?: IconComponent;
		onClick: () => void;
		disabled?: boolean;
		active?: boolean;
		isVisible: boolean;
	}

	const toolbarActions = $derived<ToolbarAction[]>([
		{
			key: 'copy-text',
			isVisible: contentText !== null && !isUnopenable,
			label: 'Copy Text', activeLabel: 'Copied Text',
			icon: Copy, activeIcon: Check,
			active: textFlash.active,
			onClick: () => { contentText && navigator.clipboard.writeText(contentText); textFlash.flash(); }
		},
		{
			key: 'copy-link',
			isVisible: Boolean(oncopylink),
			label: 'Copy Link', activeLabel: 'Copied Link',
			icon: Link, activeIcon: Check,
			active: linkFlash.active,
			onClick: () => { oncopylink?.(); linkFlash.flash(); }
		},
		{
			key: 'save-original',
			isVisible: Boolean(ondownload) && isConvertible,
			label: 'Save Original', icon: Download,
			onClick: handleDownloadOriginal
		},
		{
			key: 'save-png',
			isVisible: Boolean(ondownload) && isConvertible,
			label: converting && !convertedBlob ? 'Converting...' : 'Save PNG',
			icon: Download,
			onClick: handleDownloadPng,
			disabled: converting && !convertedBlob
		},
		{
			key: 'optimize-png',
			isVisible: Boolean(ondownload) && isConvertible,
			label: converting && !convertedBlob && isOptimizing ? 'Optimizing...' : 'Optimize PNG',
			icon: WandSparkles,
			onClick: handleOptimizePng,
			disabled: converting && !isOptimizing
		},
		{
			key: 'optimize-webp',
			isVisible: Boolean(ondownload) && isGif,
			label: gifConverting ? (gifOptimizing ? 'Optimizing...' : 'Converting...') : 'Optimize WebP',
			icon: WandSparkles,
			onClick: handleDownloadWebp,
			disabled: gifConverting
		}
	]);

	const visibleToolbarActions = $derived(toolbarActions.filter((a) => a.isVisible));

	/* --- Auto-convert on source ready --- */
	$effect(() => {
		if (!sourceBlob || !shouldAutoConvert) return;
		startConversion(false);
	});

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') onclose?.();
	};
</script>

<svelte:window on:keydown={handleKeydown} />
<div class="fixed inset-0 z-50" role="dialog" aria-modal="true" in:fade={{ duration: 200 }}>
	<button type="button" class="absolute inset-0 bg-black/80" aria-label="Close viewer" onclick={() => onclose?.()}></button>
	<div class="pointer-events-none relative z-10 flex h-full flex-col text-white">
		<!-- Toolbar -->
		<div class="pointer-events-auto flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black/70 px-4 text-xs text-white/80 backdrop-blur">
			<div class="flex items-center gap-3 overflow-hidden">
				{#if onclose}
					<Button variant="ghost" size="sm" class="h-7 shrink-0 gap-1.5 px-2 text-white/70 hover:bg-white/10 hover:text-white" onclick={onclose}>
						<ArrowLeft class="h-4 w-4" /> Back
					</Button>
				{/if}
				<span class="truncate text-sm font-medium text-white">{baseName}</span>
			</div>
			<div class="flex items-center gap-1">
				{#each visibleToolbarActions as action (action.key)}
					{@const Icon = action.active ? (action.activeIcon ?? action.icon) : action.icon}
					<Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer" disabled={action.disabled} onclick={action.onClick}>
						<Icon class="h-3.5 w-3.5" />
						{action.active ? (action.activeLabel ?? action.label) : action.label}
					</Button>
				{/each}
			</div>
		</div>
		<!-- Content -->
		<div class="pointer-events-none min-h-0 flex-1 p-3 sm:p-6">
			<div class="pointer-events-auto mx-auto flex h-full w-full max-w-6xl flex-col">
				{#if isUnopenable}
					<div class="flex h-full items-center justify-center">
						<div class="max-w-md rounded-lg border border-white/10 bg-black/60 p-6 text-center">
							<p class="text-sm font-semibold">This file type cannot be previewed.</p>
							<p class="mt-2 text-xs text-white/60">Binary files and executables are not supported for online viewing.</p>
						</div>
					</div>
				{:else if contentText !== null}
					<div class="h-full overflow-hidden rounded-lg border border-white/10 bg-[#0F111A]">
						<CodeViewer text={contentText} filename={baseName} />
					</div>
				{:else if contentUrl}
					{#if isPending}
						<div class="flex h-full items-center justify-center text-xs text-white/60">Detecting file type...</div>
					{:else if isImage}
						{#if convertedUrl}
							<div class="flex h-full items-center justify-center">
								<img src={convertedUrl} alt={baseName} title={baseName} class="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
							</div>
						{:else if converting}
							<div class="flex h-full items-center justify-center text-xs text-white/60">
								<div class="flex items-center gap-2">
									<Spinner class="size-4" />
									<span>{isOptimizing ? 'Optimizing PNG...' : `Converting ${conversionFormatLabel} to PNG...`}</span>
								</div>
							</div>
						{:else if imageInfo}
							<div class="flex h-full items-center justify-center">
								<div class="max-w-md rounded-lg border border-white/10 bg-black/60 p-6 text-center">
									<p class="text-sm font-semibold">{imageInfo.title}</p>
									{#if imageInfo.message}<p class="mt-2 text-xs text-white/60">{imageInfo.message}</p>{/if}
									{#if imageInfo.mime}<p class="mt-2 text-xs text-white/40">Detected: {imageInfo.mime}</p>{/if}
								</div>
							</div>
						{:else}
							<div class="flex h-full items-center justify-center">
								<img src={contentUrl} alt={baseName} title={baseName} class="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
							</div>
						{/if}
					{:else if isVideo}
						<div class="flex h-full items-center justify-center">
							<video src={contentUrl} class="max-h-full w-full max-w-5xl rounded-lg bg-black shadow-2xl" controls>
								<track kind="captions" label="Captions" srclang="en" src="data:text-vtt,WEBVTT%0A%0A00:00.000%20--%3E%2000:00.001%0A" />
							</video>
						</div>
					{:else if isAudio}
						<div class="flex h-full items-center justify-center">
							<audio src={contentUrl} class="w-full max-w-2xl" controls></audio>
						</div>
					{:else}
						<div class="h-full overflow-hidden rounded-lg border border-white/10 bg-black">
							<iframe src={contentUrl} title={baseName} class="h-full w-full border-0" sandbox="allow-same-origin allow-scripts"></iframe>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
