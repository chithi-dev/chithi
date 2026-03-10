<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Download, X, Link, Check, ArrowLeft, Copy } from 'lucide-svelte';
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
</script>

<div class="flex flex-col bg-card text-card-foreground" in:fade={{ duration: 200 }}>
	<!-- Toolbar -->
	<div
		class="flex h-11 shrink-0 items-center justify-between border-b border-border bg-secondary px-4 text-sm"
	>
		<div class="flex items-center gap-3 overflow-hidden">
			{#if onclose}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
					onclick={onclose}
				>
					<ArrowLeft class="h-4 w-4" />
					Back
				</Button>
			{/if}
			<span class="truncate font-medium text-foreground">{filename}</span>
		</div>
		<div class="flex items-center gap-1">
			{#if contentText !== null}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
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
					class="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
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
					class="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
					onclick={ondownload}
				>
					<Download class="h-3.5 w-3.5" />
					Save
				</Button>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto bg-card">
		{#if contentText !== null}
			<CodeViewer text={contentText} {filename} />
		{:else if contentUrl}
			<iframe
				src={contentUrl}
				title={filename}
				class="h-full w-full border-0"
				sandbox="allow-same-origin allow-scripts"
			></iframe>
		{/if}
	</div>
</div>
