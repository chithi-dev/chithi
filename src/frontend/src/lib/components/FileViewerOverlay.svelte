<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Download, Link, Check, ArrowLeft, Copy } from '@lucide/svelte';
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

	type MediaKind = 'image' | 'video' | 'audio' | 'other';

	let sniffedKind = $state<MediaKind | null>(null);
	let sniffedMime = $state<string | null>(null);
	let imageSupport = $state<ImageSupportInfo | null>(null);

	$effect(() => {
		sniffedKind = null;
		sniffedMime = null;
		imageSupport = null;

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

	const isImage = $derived(sniffedKind === 'image');
	const isVideo = $derived(sniffedKind === 'video');
	const isAudio = $derived(sniffedKind === 'audio');
	const isPending = $derived(sniffedKind === null);
	const isImageUnsupported = $derived(imageSupport?.status === 'unsupported');
	const imageSupportMessage = $derived(imageSupport?.message ?? null);

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
						{#if isImageUnsupported}
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
