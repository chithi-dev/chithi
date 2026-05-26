<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Download, Link, Check, ArrowLeft, Copy, WandSparkles, ChevronDown } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import CodeViewer from '$lib/components/CodeViewer.svelte';
	import { detectMimeFromBlob } from '$lib/functions/mime';
	import { getImageSupportInfo, type ImageSupportInfo } from '$lib/functions/media-support';
	import ConverterWorker from '$lib/workers/file-converter.worker?worker';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { buttonVariants } from '$lib/components/ui/button';

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

	const handleCopyLink = () => {
		oncopylink?.();
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => {
			copied = false;
		}, 2000);
	};

	let textCopied = $state(false);
	let textCopyTimeout: ReturnType<typeof setTimeout> | undefined;

	const handleCopyText = () => {
		if (!contentText) return;
		navigator.clipboard.writeText(contentText);
		textCopied = true;
		clearTimeout(textCopyTimeout);
		textCopyTimeout = setTimeout(() => {
			textCopied = false;
		}, 2000);
	};

	const baseName = $derived(filename.split(/[/\\]/).at(-1) ?? filename);
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
	const jxrExtensions = ['.jxr', '.wdp', '.hdp'];
	const qoiExtensions = ['.qoi'];
	const webpExtensions = ['.webp'];
	const avifExtensions = ['.avif'];
	const jxlExtensions = ['.jxl'];
	const imageExtensions = [
		...heicExtensions,
		...jxrExtensions,
		...qoiExtensions,
		...webpExtensions,
		...avifExtensions,
		...jxlExtensions,
		'.png',
		'.jpg',
		'.jpeg',
		'.svg'
	];

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
	let isOptimizing = $state(false); // Tracks oxipng status

	const resetConversionState = () => {
		conversionToken += 1;
		conversionPromise = null;
		converting = false;
		conversionStarted = false;
		conversionError = null;
		convertedBlob = null;
		convertedUrl = null;
		sourceBlob = null;
		isOptimizing = false;
	};

	const getTargetFilename = (name: string, extension: string) => {
		const lower = name.toLowerCase();
		const matched = imageExtensions.find((ext) => lower.endsWith(ext));
		if (matched) return `${name.slice(0, -matched.length)}.${extension}`;
		if (name.includes('.')) return `${name.split('.').slice(0, -1).join('.')}.${extension}`;
		return `${name}.${extension}`;
	};

	const downloadBlob = (blob: Blob, name: string) => {
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(blobUrl);
	};

	const downloadFromUrl = (url: string, name: string) => {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const startConversion = async (toMime = 'image/png', optimize = false) => {
		const isDefaultPng = toMime === 'image/png' && !optimize;

		// Only return cached blob if we're not explicitly requesting optimization and it's for preview
		if (isDefaultPng && convertedBlob) return convertedBlob;
		if (isDefaultPng && conversionPromise) return await conversionPromise;

		const token = conversionToken;
		converting = true;
		conversionStarted = true;
		conversionError = null;
		isOptimizing = false;

		const promise = (async () => {
			try {
				const isHeic = sniffedMime === 'image/heic' || sniffedMime === 'image/heif';
				const isSvg = sniffedMime === 'image/svg+xml';
				const isJxl = sniffedMime === 'image/jxl';
				const isJxr = sniffedMime === 'image/jxr';
				const isQoi = sniffedMime === 'image/qoi';
				const isWebp = sniffedMime === 'image/webp';
				const isPng = sniffedMime === 'image/png';
				const isAvif = sniffedMime === 'image/avif';

				let type: string | null = null;
				if (isHeic) type = 'heic';
				else if (isSvg) type = 'svg';
				else if (isJxl) type = 'jxl';
				else if (isJxr) type = 'jxr';
				else if (isQoi) type = 'qoi';
				else if (isWebp) type = 'webp';
				else if (isPng) type = 'png';
				else if (isAvif) type = 'avif';
				else type = sniffedMime?.split('/')[1] || null;

				if (!type) return null;

				let svgText: string | null = null;
				if (type === 'svg') {
					svgText = contentText;
					if (!svgText && contentUrl) {
						const response = await fetch(contentUrl);
						svgText = await response.text();
					}
				}

				const worker = new ConverterWorker();

				return await new Promise<Blob | null>((resolve, reject) => {
					worker.onmessage = (e) => {
						const { data } = e;

						// Handle optimization status update from worker
						if (data.type === 'status' && data.status === 'optimizing') {
							isOptimizing = true;
							return;
						}

						if (data.type === 'success') {
							const outputBlob = data.outputBlob;
							if (token === conversionToken) {
								if (!outputBlob || !(outputBlob instanceof Blob)) {
									reject(new Error('Worker returned invalid blob'));
									worker.terminate();
									return;
								}
								if (isDefaultPng) {
									convertedBlob = outputBlob;
									convertedUrl = URL.createObjectURL(outputBlob);
								}
								conversionError = null;
								isOptimizing = false;
								resolve(outputBlob);
							} else {
								resolve(null);
							}
							worker.terminate();
							return;
						}

						if (data.type === 'error') {
							if (token === conversionToken) {
								conversionError = `Could not convert this ${sniffedMime?.split('/')[1]?.toUpperCase()} image to ${toMime.split('/')[1].toUpperCase()}.`;
								isOptimizing = false;
							}
							reject(new Error(data.message));
							worker.terminate();
						}
					};
					worker.onerror = (event) => {
						if (token === conversionToken) isOptimizing = false;
						reject(event);
						worker.terminate();
					};
					// Send source data to the worker for conversion
					worker.postMessage({
						type,
						toType: toMime,
						blob: sourceBlob,
						text: svgText,
						optimize
					});
				});
			} catch (error) {
				console.error('Conversion failed:', error);
				if (token === conversionToken) {
					conversionError = `Could not convert image.`;
					isOptimizing = false;
				}
				return null;
			} finally {
				if (token === conversionToken) {
					converting = false;
					if (isDefaultPng) conversionPromise = null;
				}
			}
		})();
		if (isDefaultPng) conversionPromise = promise;
		return await promise;
	};

	const handleDownloadOriginal = () => {
		if (ondownload) {
			ondownload();
			return;
		}
		if (contentText !== null) {
			downloadBlob(new Blob([contentText], { type: 'text/plain' }), baseName);
			return;
		}
		if (contentUrl) downloadFromUrl(contentUrl, baseName);
	};

	const handleDownload = async (mime: string, optimize = false) => {
		const blob = await startConversion(mime, optimize);
		if (blob) {
			const extension = mime.split('/')[1];
			downloadBlob(blob, getTargetFilename(baseName, extension));
		}
	};

	$effect(() => {
		sniffedKind = null;
		sniffedMime = null;
		imageSupport = null;
		resetConversionState();
		if (!contentUrl || contentText !== null || isUnopenable) return;
		let cancelled = false;

		const sniff = async () => {
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
					if (
						mime === 'image/heic' ||
						mime === 'image/heif' ||
						mime === 'image/jxl' ||
						mime === 'image/jxr' ||
						mime === 'image/qoi' ||
						mime === 'image/svg+xml' ||
						mime === 'image/webp' ||
						mime === 'image/png'
					) {
						sourceBlob = blob;
					}
				}

				if (kind === 'image' && mime) {
					const supportInfo = await getImageSupportInfo(mime);
					if (!cancelled) imageSupport = supportInfo;
				}
			} catch {
				if (!cancelled) sniffedKind = 'other';
			}
		};

		sniff();

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
	const isJxr = $derived(sniffedMime === 'image/jxr');
	const isQoi = $derived(sniffedMime === 'image/qoi');
	const isSvg = $derived(sniffedMime === 'image/svg+xml');
	const isWebp = $derived(sniffedMime === 'image/webp');
	const isPng = $derived(sniffedMime === 'image/png');
	const isAvif = $derived(sniffedMime === 'image/avif');
	const isImage = $derived(sniffedKind === 'image');
	const isVideo = $derived(sniffedKind === 'video');
	const isAudio = $derived(sniffedKind === 'audio');
	const isPending = $derived(sniffedKind === null);
	const isImageUnsupported = $derived(
		!isHeic &&
			!isJxl &&
			!isJxr &&
			!isQoi &&
			!isSvg &&
			!isWebp &&
			!isPng &&
			!isAvif &&
			imageSupport?.status === 'unsupported'
	);
	const imageSupportMessage = $derived(imageSupport?.message ?? null);
	const isConvertible = $derived(
		isHeic || isJxl || isJxr || isQoi || isSvg || isWebp || isPng || isAvif
	);
	const shouldAutoConvert = $derived(
		isConvertible && (!isWebp || imageSupport?.status === 'unsupported')
	);
	const imageInfo = $derived<ImageInfo | null>(
		isConvertible && conversionStarted && !converting && !convertedUrl
			? {
					title:
						conversionError ??
						`Unable to preview this ${sniffedMime?.split('/')[1]?.toUpperCase()} image.`,
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
		}
	]);
	const visibleToolbarActions = $derived(toolbarActions.filter((action) => action.isVisible));
	const isDownloadable = $derived(
		Boolean(ondownload) || Boolean(contentUrl) || contentText !== null
	);

	$effect(() => {
		if (!sourceBlob || !shouldAutoConvert) return;
		startConversion('image/png', false); // Default to fast conversion for preview
	});

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') onclose?.();
	};
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
						class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
						disabled={action.disabled}
						onclick={action.onClick}
					>
						<Icon class="h-3.5 w-3.5" />
						{action.active ? (action.activeLabel ?? action.label) : action.label}
					</Button>
				{/each}

				{#if isDownloadable}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class={buttonVariants({
								variant: 'ghost',
								size: 'sm',
								class:
									'h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
							})}
							disabled={converting && !convertedBlob}
						>
							<Download class="h-3.5 w-3.5" />
							{converting && !convertedBlob ? 'Converting...' : 'Download'}
							<ChevronDown class="h-3 w-3 opacity-50" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-48 border-white/10 bg-black/90 text-white">
							<DropdownMenu.Group>
								<DropdownMenu.Label class="text-xs text-white/50">Original File</DropdownMenu.Label>
								<DropdownMenu.Item
									class="cursor-pointer focus:bg-white/10 focus:text-white"
									onSelect={handleDownloadOriginal}
								>
									<Download class="mr-2 h-4 w-4" />
									<span>Save Original</span>
								</DropdownMenu.Item>
							</DropdownMenu.Group>
							{#if isConvertible}
								<DropdownMenu.Separator class="bg-white/10" />
								<DropdownMenu.Group>
									<DropdownMenu.Label class="text-xs text-white/50"
										>Conversion Options</DropdownMenu.Label
									>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/png', true)}
									>
										<WandSparkles class="mr-2 h-4 w-4" />
										<span>PNG (Optimized)</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/png', false)}
									>
										<Download class="mr-2 h-4 w-4" />
										<span>PNG (Fast)</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/webp')}
									>
										<Download class="mr-2 h-4 w-4" />
										<span>WebP</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/avif')}
									>
										<Download class="mr-2 h-4 w-4" />
										<span>AVIF</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/jxl')}
									>
										<Download class="mr-2 h-4 w-4" />
										<span>JXL</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer focus:bg-white/10 focus:text-white"
										onSelect={() => handleDownload('image/qoi')}
									>
										<Download class="mr-2 h-4 w-4" />
										<span>QOI</span>
									</DropdownMenu.Item>
								</DropdownMenu.Group>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
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
										{isOptimizing ? 'Optimizing PNG...' : 'Converting'}
										{#if isHeic}
											HEIC
										{:else if isJxl}
											JXL
										{:else if isJxr}
											JXR
										{:else if isQoi}
											QOI
										{:else if isWebp}
											WEBP
										{:else if isSvg}
											SVG
										{:else}
											PNG
										{/if} to PNG...
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
