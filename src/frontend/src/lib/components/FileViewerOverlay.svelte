<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Download, Link, Check, ArrowLeft, Copy } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import CodeViewer from '$lib/components/CodeViewer.svelte';
	import { detectMimeFromBlob } from '$lib/functions/mime';
	import { getImageSupportInfo, type ImageSupportInfo } from '$lib/functions/media-support';

	const { heicTo } = await import('heic-to');

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

	type MediaKind = 'image' | 'video' | 'audio' | 'other';

	const heicExtensions = ['.heic', '.heif'];

	let sniffedKind = $state<MediaKind | null>(null);
	let sniffedMime = $state<string | null>(null);
	let imageSupport = $state<ImageSupportInfo | null>(null);
	let sourceBlob = $state<Blob | null>(null);
	let heicConvertedBlob = $state<Blob | null>(null);
	let heicConvertedUrl = $state<string | null>(null);
	let heicConverting = $state(false);
	let heicError = $state<string | null>(null);
	let heicConversionToken = 0;
	let heicConvertPromise: Promise<Blob | null> | null = null;

	function resetHeicState() {
		heicConversionToken += 1;
		heicConvertPromise = null;
		heicConverting = false;
		heicError = null;
		heicConvertedBlob = null;
		heicConvertedUrl = null;
		sourceBlob = null;
	}

	function getPngFilename(name: string) {
		const lower = name.toLowerCase();
		const matched = heicExtensions.find((ext) => lower.endsWith(ext));
		if (matched) return `${name.slice(0, -matched.length)}.png`;
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

	async function convertHeicToPng() {
		if (heicConvertedBlob) return heicConvertedBlob;
		if (!sourceBlob) return null;
		if (heicConvertPromise) return await heicConvertPromise;

		const token = heicConversionToken;
		heicConverting = true;
		heicError = null;

		heicConvertPromise = (async () => {
			try {
				const result = await heicTo({ blob: sourceBlob, type: 'image/png' });
				const pngBlob = result instanceof Blob ? result : null;
				if (!pngBlob || token !== heicConversionToken) return null;
				heicConvertedBlob = pngBlob;
				heicConvertedUrl = URL.createObjectURL(pngBlob);
				return pngBlob;
			} catch {
				if (token === heicConversionToken) {
					heicError = 'Could not convert this HEIC image.';
				}
				return null;
			} finally {
				if (token === heicConversionToken) {
					heicConverting = false;
					heicConvertPromise = null;
				}
			}
		})();

		return await heicConvertPromise;
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
		const pngBlob = await convertHeicToPng();
		if (!pngBlob) return;
		downloadBlob(pngBlob, getPngFilename(baseName));
	}

	$effect(() => {
		sniffedKind = null;
		sniffedMime = null;
		imageSupport = null;
		resetHeicState();

		if (!contentUrl || contentText !== null) return;

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
					if (mime === 'image/heic' || mime === 'image/heif') {
						sourceBlob = blob;
					}
				}
			} catch {
				if (!cancelled) {
					sniffedKind = 'other';
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const url = heicConvertedUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	const isHeic = $derived(sniffedMime === 'image/heic' || sniffedMime === 'image/heif');
	const isImage = $derived(sniffedKind === 'image');
	const isVideo = $derived(sniffedKind === 'video');
	const isAudio = $derived(sniffedKind === 'audio');
	const isPending = $derived(sniffedKind === null);
	const isImageUnsupported = $derived(!isHeic && imageSupport?.status === 'unsupported');
	const imageSupportMessage = $derived(imageSupport?.message ?? null);

	$effect(() => {
		if (!sourceBlob || !isHeic) return;
		void convertHeicToPng();
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
						<ArrowLeft class="h-4 w-4" />
						Back
					</Button>
				{/if}
				<span class="truncate text-sm font-medium text-white">{baseName}</span>
			</div>
			<div class="flex items-center gap-1">
				{#if contentText !== null}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
						onclick={handleCopyText}
					>
						{#if textCopied}
							<Check class="h-3.5 w-3.5" />
							Copied Text
						{:else}
							<Copy class="h-3.5 w-3.5" />
							Copy Text
						{/if}
					</Button>
				{/if}
				{#if oncopylink}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
						onclick={handleCopyLink}
					>
						{#if copied}
							<Check class="h-3.5 w-3.5" />
							Copied Link
						{:else}
							<Link class="h-3.5 w-3.5" />
							Copy Link
						{/if}
					</Button>
				{/if}
				{#if ondownload}
					{#if isHeic}
						<Button
							variant="ghost"
							size="sm"
							class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
							onclick={handleDownloadOriginal}
						>
							<Download class="h-3.5 w-3.5" />
							Save Original
						</Button>
						<Button
							variant="ghost"
							size="sm"
							class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
							disabled={heicConverting && !heicConvertedBlob}
							onclick={handleDownloadPng}
						>
							<Download class="h-3.5 w-3.5" />
							{#if heicConverting && !heicConvertedBlob}
								Converting...
							{:else}
								Save PNG
							{/if}
						</Button>
					{:else}
						<Button
							variant="ghost"
							size="sm"
							class="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
							onclick={ondownload}
						>
							<Download class="h-3.5 w-3.5" />
							Save
						</Button>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Content -->
		<div class="pointer-events-none min-h-0 flex-1 p-3 sm:p-6">
			<div class="pointer-events-auto mx-auto flex h-full w-full max-w-6xl flex-col">
				{#if contentText !== null}
					<div class="h-full overflow-hidden rounded-lg border border-white/10 bg-[#0F111A]">
						<CodeViewer text={contentText} filename={baseName} />
					</div>
				{:else if contentUrl}
					{#if isPending}
						<div class="flex h-full items-center justify-center text-xs text-white/60">
							Detecting file type...
						</div>
					{:else if isImage}
						{#if isHeic}
							{#if heicConverting && !heicConvertedUrl}
								<div class="flex h-full items-center justify-center text-xs text-white/60">
									Converting HEIC to PNG...
								</div>
							{:else if heicConvertedUrl}
								<div class="flex h-full items-center justify-center">
									<img
										src={heicConvertedUrl}
										alt={baseName}
										title={baseName}
										class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
									/>
								</div>
							{:else}
								<div class="flex h-full items-center justify-center">
									<div
										class="max-w-md rounded-lg border border-white/10 bg-black/60 p-6 text-center"
									>
										<p class="text-sm font-semibold">
											{heicError ?? 'Unable to preview this HEIC image.'}
										</p>
										{#if imageSupportMessage}
											<p class="mt-2 text-xs text-white/60">{imageSupportMessage}</p>
										{/if}
										{#if sniffedMime}
											<p class="mt-2 text-xs text-white/40">Detected: {sniffedMime}</p>
										{/if}
									</div>
								</div>
							{/if}
						{:else if isImageUnsupported}
							<div class="flex h-full items-center justify-center">
								<div class="max-w-md rounded-lg border border-white/10 bg-black/60 p-6 text-center">
									<p class="text-sm font-semibold">
										This image format is not supported in this browser.
									</p>
									{#if imageSupportMessage}
										<p class="mt-2 text-xs text-white/60">{imageSupportMessage}</p>
									{/if}
									{#if sniffedMime}
										<p class="mt-2 text-xs text-white/40">Detected: {sniffedMime}</p>
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
									src="data:text/vtt,WEBVTT%0A%0A00:00.000%20--%3E%2000:00.001%0A"
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
