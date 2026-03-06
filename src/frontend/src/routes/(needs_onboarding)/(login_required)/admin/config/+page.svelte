<script lang="ts">
	import { LoaderCircle } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { useConfigQuery } from '#queries/config';
	import { formatBytes, type ByteUnit } from '#functions/bytes';
	import { type TimeUnit } from '#functions/times';
	import ConfigLoadingSkeleton from './config_loading_skeleton.svelte';
	import StorageFilesCard from './storage_file_card.svelte';
	import RetentionPolicyCard from './retention_policy_card.svelte';
	import FileSecurityCard from './file_security_card.svelte';
	import SiteDescriptionCard from './site_description_card.svelte';

	const { config: configQuery, update_config } = useConfigQuery();

	let configData = $derived(configQuery.data);
	let descDraft = $state('');
	let previewMarkdown = $derived(
		descDraft ? String(descDraft) : (configData?.site_description ?? '')
	);

	let editing = $state<
		'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null
	>(null);
	let editVal = $state(0);
	let editUnit = $state<ByteUnit>('GB');
	let tempInput = $state({
		dl: 0,
		time: 0,
		timeUnit: 'Hours' as TimeUnit,
		allowedStr: '',
		bannedStr: ''
	});

	const LIMITS = Object.freeze({
		site_description: {
			words: 150,
			paragraph: 3,
			chars: 1000
		}
	});

	let descWordCount = $derived(
		descDraft ? descDraft.trim().split(/\s+/).filter(Boolean).length : 0
	);
	let descCharCount = $derived(descDraft ? String(descDraft).length : 0);
	let descParagraphCount = $derived(
		descDraft ? descDraft.split(/\n{2,}/).filter((p) => p.trim().length).length : 0
	);
	let descExceeds = $derived(
		descWordCount > LIMITS.site_description.words ||
			descCharCount > LIMITS.site_description.chars ||
			descParagraphCount > LIMITS.site_description.paragraph
	);

	function startEdit(type: 'storage' | 'file') {
		if (!configData) return;
		const bytes =
			type === 'storage' ? configData.total_storage_limit : configData.max_file_size_limit;
		const f = formatBytes(bytes);
		editVal = f.val;
		editUnit = f.unit;
		editing = type;
	}

	async function save(payload: any) {
		try {
			await update_config(payload);
		} catch (error) {
			console.error('Save failed:', error);
		}
	}

	function openDescriptionEditor() {
		editing = 'desc';
		descDraft = configData?.site_description ?? '';
	}
</script>

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<h2 class="text-3xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">
			Manage your <code>{page.url.origin}</code> chithi instance.
		</p>
	</div>
</div>

<div class="space-y-6">
	{#if configQuery.isFetching}
		<div
			in:fade
			class="fixed top-24 right-10 z-50 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase shadow-sm backdrop-blur-sm"
		>
			<LoaderCircle class="size-3.5 animate-spin" /> Syncing
		</div>
	{/if}

	{#if configQuery.isLoading}
		<ConfigLoadingSkeleton />
	{:else if configData}
		<StorageFilesCard {configData} bind:editing bind:editVal bind:editUnit {startEdit} {save} />
		<RetentionPolicyCard {configData} bind:editing bind:tempInput {save} />
		<FileSecurityCard {configData} bind:editing bind:tempInput {save} />
		<SiteDescriptionCard
			bind:editing
			bind:descDraft
			{previewMarkdown}
			{descWordCount}
			{descExceeds}
			wordLimit={LIMITS.site_description.words}
			{save}
			openEditor={openDescriptionEditor}
		/>
	{/if}
</div>
