<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { fade, slide } from 'svelte/transition';
	import { markdown_to_html } from '$lib/markdown/markdown';

	let {
		editing = $bindable(),
		descDraft = $bindable(),
		previewMarkdown,
		descWordCount,
		descExceeds,
		wordLimit,
		save,
		openEditor
	}: {
		editing: 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;
		descDraft: string;
		previewMarkdown: string;
		descWordCount: number;
		descExceeds: boolean;
		wordLimit: number;
		save: (payload: any) => Promise<void>;
		openEditor: () => void;
	} = $props();
</script>

<Card.Root class="border bg-background">
	<Card.Header class="flex flex-row items-center justify-between px-6 py-4">
		<div>
			<Card.Title class="text-base font-medium">Site Description</Card.Title>
			<Card.Description class="mt-1"
				>Markdown content displayed on the public homepage.</Card.Description
			>
		</div>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				if (editing === 'desc') {
					editing = null;
				} else {
					openEditor();
				}
			}}
		>
			{editing === 'desc' ? 'Cancel' : 'Edit Description'}
		</Button>
	</Card.Header>
	<Card.Content class="p-0">
		{#if editing === 'desc'}
			<div in:slide class="flex flex-col">
				<div class="p-6 pb-2">
					<textarea
						bind:value={descDraft}
						class="min-h-75 w-full resize-y rounded-md border bg-background p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
						placeholder="Enter your site description in Markdown..."
					></textarea>
					<div class="mt-2 flex justify-between text-xs text-muted-foreground">
						<span>Supports basic Markdown</span>
						<span class={descExceeds ? 'font-bold text-destructive' : ''}>
							{descWordCount}/{wordLimit} words
						</span>
					</div>
				</div>
				<div class="flex justify-end gap-2 border-t bg-muted/20 p-4">
					<Button variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
					<Button
						onclick={() => {
							save({ site_description: descDraft });
							editing = null;
						}}
						disabled={descExceeds}>Save Changes</Button
					>
				</div>
			</div>
		{:else}
			<div
				in:fade
				class="prose max-w-none p-8 text-sm leading-relaxed prose-zinc dark:prose-invert"
			>
				{#await markdown_to_html(previewMarkdown) then html}
					{@html html}
				{/await}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
