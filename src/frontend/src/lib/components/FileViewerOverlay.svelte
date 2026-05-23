<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Download, Link, Check, ArrowLeft, Copy, Wand2 } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import CodeViewer from '$lib/components/CodeViewer.svelte';
	import { detectMimeFromBlob } from '$lib/functions/mime';
	import { getImageSupportInfo, type ImageSupportInfo } from '$lib/functions/media-support';

	let {
		filename,
		contentText = null,
		contentUrl = null,
		onclose,
		ondownload,
		oncopylink
	} = $props<{
		filename: string;
		contentText?: string | null;
		contentUrl?: string | null;
		onclose?: () => void;
		ondownload?: () => void;
		oncopylink?: () => void;
	}>();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleCopyLink() {
		oncopylink?.();
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => (copied = false), 2000);
	}
	let textCopied = $state(false);
	let textCopyTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleCopyText() {
		if (contentText) {
			navigator.clipboard.writeText(contentText);
			textCopied = true;
			clearTimeout(textCopyTimeout);
			textCopyTimeout = setTimeout(() => (textCopied = false), 2000);
		}
	}

	const baseName = $derived(filename.split(/[/\\]/).pop() ?? filename);
	const unopenableExtensions = [
		'.exe',
		'.bin',
		'.so',
		'.dll',
		'.msi',
		'.app',
		'.dmg',
		'.pkg',
		'.iso',
		'.vmdk',
		'.a',
		'.lib',
		'.obj',
		'.o',
		'.pyc',
		'.pyo',
		'.pyd',
		'.deb',
		'.rpm'
	];
	const isUnopenable = $derived(
		unopenableExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
	);

	type MediaKind = 'image' | 'video' | 'audio' | 'other';
	type ImageInfo = { title: string; message?: string | null; mime?: string | null };
	type IconComponent = typeof Link;
	type ToolbarAction = {
		key: string;
		label: string;
		activeLabel?: string;
		icon: IconComponent;
		activeIcon?: IconComponent;
		onClick: () => void;
		disabled?: boolean;
		active?: boolean;
		isVisible: boolean;
	};

	const heicExtensions = ['.heic', '.heif'];
	let sniffedKind = $state<MediaKind | null>(null);
	let sniffedMime = $state<string | null>(null);
	let imageSupport = $state<ImageSupportInfo | null>(null);
	let sourceBlob = $state<Blob | null>(null);
	let convertedBlob = $state<Blob | null>(null);
	let convertedUrl = $state<string | null>(null);
	let converting = $state(false);
	let conversionStarted = $state(false);
	let conversionError = $state<string | null>(null);
	let conversionToken = 0;
	let conversionPromise: Promise<Blob | null> | null = null;
	let isOptimizing = $state(false); // New state for oxipng step

	function resetConversionState() {
		conversionToken += 1;
		conversionPromise = null;
		converting = false;
		conversionStarted = false;
		conversionError = null;
		convertedBlob = null;
		convertedUrl = null;
		sourceBlob = null;
		isOptimizing = false;
	}

	function getPngFilename(name: string) {
		const lower = name.toLowerCase();
		const matched = heicExtensions.find((ext) => lower.endsWith(ext));
		if (matched) return `${name.slice(0, -matched.length)}.png`;
		if (lower.endsWith('.svg')) return `${name.slice(0, -4)}.png`;
		if (lower.endsWith('.jxl')) return `${name.slice(0, -4)}.png`;
		return `${name}.png`;
	}

	function downloadBlob(blob: Blob, name: string) {
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(blobUrl);
	}

	function downloadFromUrl(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	async function startConversion(optimize = false) {
		if (convertedBlob && !optimize) return convertedBlob;
		if (conversionPromise) return await conversionPromise;

		const token = conversionToken;
		converting = true;
		conversionStarted = true;
		conversionError = null;
		isOptimizing = false;

		conversionPromise = (async () => {
			try {
				const isHeic = sniffedMime === 'image/heic' || sniffedMime === 'image/heif';
				const isSvg = sniffedMime === 'image/svg+xml';
				const isJxl = sniffedMime === 'image/jxl';
				const isPng = sniffedMime === 'image/png';
				const type = isHeic ? 'heic' : isSvg ? 'svg' : isJxl ? 'jxl' : isPng ? 'png' : null;
				if (!type) return null;

				let svgText = null;
				if (type === 'svg') {
					svgText = contentText;
					if (!svgText && contentUrl) {
						const response = await fetch(contentUrl);
						svgText = await response.text();
					}
				}

				const ConverterWorker = (await import('$lib/workers/file-converter.worker?worker')).default;
				const worker = new ConverterWorker();

				return await new Promise<Blob | null>((resolve, reject) => {
					worker.onmessage = (e) => {
						// Handle optimization status update
						if (e.data.type === 'status' && e.data.status === 'optimizing') {
							isOptimizing = true;
							return;
						}

						if (e.data.type === 'success') {
							const pngBlob = e.data.pngBlob;
							if (token === conversionToken) {
								if (pngBlob && pngBlob instanceof Blob) {
									convertedBlob = pngBlob;
									convertedUrl = URL.createObjectURL(pngBlob);
									conversionError = null;
									isOptimizing = false;
									resolve(pngBlob);
								} else {
									reject(new Error('Worker returned invalid blob'));
								}
							} else {
								resolve(null);
							}
							worker.terminate();
						} else if (e.data.type === 'error') {
							if (token === conversionToken) {
								conversionError = `Could not convert this ${sniffedMime?.split('/')[1].toUpperCase()} image.`;
								isOptimizing = false;
							}
							reject(new Error(e.data.message));
							worker.terminate();
						}
					};
					worker.onerror = (e) => {
						if (token === conversionToken) isOptimizing = false;
						reject(e);
						worker.terminate();
					};
					worker.postMessage({ type, blob: sourceBlob, text: svgText, optimize });
				});
			} catch (e: any) {
				console.error('Conversion failed:', e);
				if (token === conversionToken) {
					conversionError = `Could not convert this ${sniffedMime?.split('/')[1].toUpperCase()} image.`;
					isOptimizing = false;
				}
				return null;
			} finally {
				if (token === conversionToken) {
					converting = false;
					conversionPromise = null;
				}
			}
		})();
		return await conversionPromise;
	}

	function handleDownloadOriginal() {
		if (ondownload) {
			ondownload();
			return;
		}
		if (contentText !== null) {
			downloadBlob(new Blob([contentText], { type: 'text/plain' }), baseName);
			return;
		}
		if (contentUrl) downloadFromUrl(contentUrl, baseName);
	}

	async function handleDownloadPng() {
		const pngBlob = await startConversion(false);
		if (pngBlob) {
			downloadBlob(pngBlob, getPngFilename(baseName));
		}
	}

	async function handleOptimizePng() {
		const pngBlob = await startConversion(true);
		if (pngBlob) {
			downloadBlob(pngBlob, getPngFilename(baseName));
		}
	}

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
				const blobMime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : null;
				const mime = detectedMime ?? blobMime;
				const kind: MediaKind = mime?.startsWith('image/')
					? 'image'
					: mime?.startsWith('video/')
						? 'video'
						: mime?.startsWith('audio/')
							? 'audio'
							: 'other';
				if (!cancelled) {
					sniffedMime = mime;
					sniffedKind = kind;
					imageSupport = kind === 'image' && mime ? getImageSupportInfo(mime) : null;
					if (
						mime === 'image/heic' ||
						mime === 'image/heif' ||
						mime === 'image/jxl' ||
						mime === 'image/svg+xml' ||
						mime === 'image/png'
					) {
						sourceBlob = blob;
					}
				}
			} catch {
				if (!cancelled) sniffedKind = 'other';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const url = convertedUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	const isHeic = $derived(sniffedMime === 'image/heic' || sniffedMime === 'image/heif');
	const isJxl = $derived(sniffedMime === 'image/jxl');
	const isSvg = $derived(sniffedMime === 'image/svg+xml');
	const isPng = $derived(sniffedMime === 'image/png');
	const isImage = $derived(sniffedKind === 'image');
	const isVideo = $derived(sniffedKind === 'video');
	const isAudio = $derived(sniffedKind === 'audio');
	const isPending = $derived(sniffedKind === null);
	const isImageUnsupported = $derived(
		!isHeic && !isJxl && !isSvg && !isPng && imageSupport?.status === 'unsupported'
	);
	const imageSupportMessage = $derived(imageSupport?.message ?? null);
	const isConvertible = $derived(isHeic || isJxl || isSvg || isPng);
	const imageInfo = $derived<ImageInfo | null>(
		isConvertible && conversionStarted && !converting && !convertedUrl
			? {
					title:
						conversionError ??
						`Unable to preview this ${sniffedMime?.split('/')[1].toUpperCase()} image.`,
					message: imageSupportMessage,
					mime: sniffedMime
				}
			: isImageUnsupported
				? {
						title: 'This image format is not supported in this browser.',
						message: imageSupportMessage,
						mime: sniffedMime
					}
				: null
	);

	const toolbarActions = $derived<ToolbarAction[]>([
		{
			key: 'copy-text',
			isVisible: contentText !== null && !isUnopenable,
			label: 'Copy Text',
			activeLabel: 'Copied Text',
			icon: Copy,
			activeIcon: Check,
			active: textCopied,
			onClick: handleCopyText
		},
		{
			key: 'copy-link',
			isVisible: Boolean(oncopylink),
			label: 'Copy Link',
			activeLabel: 'Copied Link',
			icon: Link,
			activeIcon: Check,
			active: copied,
			onClick: handleCopyLink
		},
		{
			key: 'save-original',
			isVisible: Boolean(ondownload) && isConvertible,
			label: 'Save Original',
			icon: Download,
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
			icon: Wand2,
			onClick: handleOptimizePng,
			disabled: converting && !isOptimizing
		}
	]);
	const visibleToolbarActions = $derived(toolbarActions.filter((action) => action.isVisible));

	$effect(() => {
		if (!sourceBlob || !isConvertible) return;
		startConversion(false); // Default to fast conversion/preview
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose?.();
	}
</script>

<svelte:window on:keydown={handleKeydown} />
<div class="fixed inset-0 z-50" role="dialog" aria-modal="true" in:fade={{ duration: 200 }}>
	<button
		type="button"
		class="absolute inset-0 bg-black/80"
		aria-label="Close viewer"
		onclick={() => onclose?.()}
	></button>
	<div class="pointer-events-none relative z-10 flex h-full flex-col text-white">
		<!-- Toolbar -->
		<div
			class="pointer-events-auto flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black/70 px-4 text-xs text-white/80 backdrop-blur"
		>
			<div class="flex items-center gap-3 overflow-hidden">
				{#if onclose}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 shrink-0 gap-1.5 px-2 text-white/70 hover:bg-white/10 hover:text-white"
						onclick={onclose}
					>
						<ArrowLeft class="h-4 w-4" /> Back
					</Button>
				{/if}
				<span class="truncate text-sm font-medium text-white">{baseName}</span>
			</div>
			<div class="flex items-center gap-1">
				{#each visibleToolbarActions as action (action.key)}
					{@const Icon = action.active ? (action.activeIcon ?? action.icon) : action.icon}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
						disabled={action.disabled}
						onclick={action.onClick}
					>
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
							<p class="mt-2 text-xs text-white/60">
								Binary files and executables are not supported for online viewing.
							</p>
						</div>
					</div>
				{:else if contentText !== null}
					<div class="h-full overflow-hidden rounded-lg border border-white/10 bg-[#0F111A]">
						<CodeViewer text={contentText} filename={baseName} />
					</div>
				{:else if contentUrl}
					{#if isPending}
						<div class="flex h-full items-center justify-center text-xs text-white/60">
							Detecting file type...
						</div>
					{:else if isImage}
						{#if convertedUrl}
							<div class="flex h-full items-center justify-center">
								<img
									src={convertedUrl}
									alt={baseName}
									title={baseName}
									class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
								/>
							</div>
						{:else if converting}
							<div class="flex h-full items-center justify-center text-xs text-white/60">
								<div class="flex items-center gap-2">
									<Spinner class="size-4" />
									<span>
										{isOptimizing ? 'Optimizing PNG...' : isPng ? 'Optimizing' : 'Converting'}
										{isHeic ? 'HEIC' : isJxl ? 'JXL' : isSvg ? 'SVG' : 'PNG'} to PNG...
									</span>
								</div>
							</div>
						{:else if imageInfo}
							<div class="flex h-full items-center justify-center">
								<div class="max-w-md rounded-lg border border-white/10 bg-black/60 p-6 text-center">
									<p class="text-sm font-semibold">{imageInfo.title}</p>
									{#if imageInfo.message}
										<p class="mt-2 text-xs text-white/60">{imageInfo.message}</p>
									{/if}
									{#if imageInfo.mime}
										<p class="mt-2 text-xs text-white/40">Detected: {imageInfo.mime}</p>
									{/if}
								</div>
							</div>
						{:else}
							<div class="flex h-full items-center justify-center">
								<img
									src={contentUrl}
									alt={baseName}
									title={baseName}
									class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
								/>
							</div>
						{/if}
					{:else if isVideo}
						<div class="flex h-full items-center justify-center">
							<video
								src={contentUrl}
								class="max-h-full w-full max-w-5xl rounded-lg bg-black shadow-2xl"
								controls
							>
								<track
									kind="captions"
									label="Captions"
									srclang="en"
									src="data:text-vtt,WEBVTT%0A%0A00:00.000%20--%3E%2000:00.001%0A"
								/>
							</video>
						</div>
					{:else if isAudio}
						<div class="flex h-full items-center justify-center">
							<audio src={contentUrl} class="w-full max-w-2xl" controls></audio>
						</div>
					{:else}
						<div class="h-full overflow-hidden rounded-lg border border-white/10 bg-black">
							<iframe
								src={contentUrl}
								title={baseName}
								class="h-full w-full border-0"
								sandbox="allow-same-origin allow-scripts"
							></iframe>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
