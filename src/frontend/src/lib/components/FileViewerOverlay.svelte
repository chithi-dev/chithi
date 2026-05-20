<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Download, Link, Check, ArrowLeft, Copy } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import CodeViewer from '$lib/components/CodeViewer.svelte';

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

	type SniffedKind = 'image' | 'video' | 'audio' | 'other';

	let sniffedKind = $state<SniffedKind | null>(null);

	const isMediaKind = (value: string | null): value is 'image' | 'video' | 'audio' =>
		value === 'image' || value === 'video' || value === 'audio';

	function sniffKindFromBytes(
		bytes: Uint8Array,
		textSample: string | null
	): { kind: SniffedKind; mime: string | null } {
		const startsWith = (...header: number[]) =>
			header.every((value, index) => bytes[index] === value);

		if (
			startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ||
			startsWith(0xff, 0xd8, 0xff) ||
			startsWith(0x47, 0x49, 0x46, 0x38) ||
			startsWith(0x42, 0x4d) ||
			startsWith(0x00, 0x00, 0x01, 0x00)
		) {
			return { kind: 'image', mime: null };
		}

		if (
			startsWith(0x52, 0x49, 0x46, 0x46) &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		) {
			return { kind: 'image', mime: 'image/webp' };
		}

		if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) {
			return { kind: 'video', mime: 'video/webm' };
		}

		if (startsWith(0x4f, 0x67, 0x67, 0x53)) {
			return { kind: 'audio', mime: 'audio/ogg' };
		}

		if (
			startsWith(0x52, 0x49, 0x46, 0x46) &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x41 &&
			bytes[10] === 0x56 &&
			bytes[11] === 0x45
		) {
			return { kind: 'audio', mime: 'audio/wav' };
		}

		if (startsWith(0x66, 0x4c, 0x61, 0x43)) {
			return { kind: 'audio', mime: 'audio/flac' };
		}

		if (startsWith(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
			return { kind: 'audio', mime: 'audio/mpeg' };
		}

		if (
			startsWith(0x66, 0x74, 0x79, 0x70) &&
			textSample &&
			/ftyp(avif|heic|m4a|mp4|isom|qt  )/i.test(textSample)
		) {
			const isAudio = /ftypm4a/i.test(textSample);
			return { kind: isAudio ? 'audio' : 'video', mime: null };
		}

		if (textSample && /<svg[\s>]/i.test(textSample)) {
			return { kind: 'image', mime: 'image/svg+xml' };
		}

		return { kind: 'other', mime: null };
	}

	$effect(() => {
		sniffedKind = null;

		if (!contentUrl || contentText !== null) return;

		let cancelled = false;

		(async () => {
			try {
				const response = await fetch(contentUrl);
				const blob = await response.blob();
				const headerBlob = blob.slice(0, 2048);
				const buffer = await headerBlob.arrayBuffer();
				const bytes = new Uint8Array(buffer);
				const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
				const fromBytes = sniffKindFromBytes(bytes, textSample);
				const fromMime = blob.type?.split('/')[0] ?? null;

				if (!cancelled) {
					sniffedKind = isMediaKind(fromMime) ? fromMime : fromBytes.kind;
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
				<span class="truncate text-sm font-medium text-white">{filename}</span>
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
						<CodeViewer text={contentText} {filename} />
					</div>
				{:else if contentUrl}
					{#if isImage}
						<div class="flex h-full items-center justify-center">
							<img
								src={contentUrl}
								alt={filename}
								class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
							/>
						</div>
					{:else if isVideo}
						<div class="flex h-full items-center justify-center">
							<video
								src={contentUrl}
								class="max-h-full w-full max-w-5xl rounded-lg bg-black shadow-2xl"
								controls
							>
								<track kind="captions" label="Captions" srclang="en" />
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
								title={filename}
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
