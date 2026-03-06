<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Item from '$lib/components/ui/item';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { slide } from 'svelte/transition';
	import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '#functions/bytes';

	let {
		configData,
		editing = $bindable(),
		editVal = $bindable(),
		editUnit = $bindable(),
		startEdit,
		save
	}: {
		configData: any;
		editing: 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;
		editVal: number;
		editUnit: ByteUnit;
		startEdit: (type: 'storage' | 'file') => void;
		save: (payload: any) => Promise<void>;
	} = $props();
</script>

<Card.Root class="border bg-background">
	<Card.Header class="px-6 py-4">
		<Card.Title class="text-base font-medium">Storage & Files</Card.Title>
	</Card.Header>
	<Card.Content class="p-0">
		<Item.Group>
			<Item.Root>
				<Item.Content>
					<Item.Title>Storage Limit</Item.Title>
					<Item.Description class="line-clamp-none text-wrap">
						The total storage capacity allocated for this instance. Older files may be pruned if
						this limit is reached.
					</Item.Description>
				</Item.Content>
				<Item.Actions class="w-full flex-col items-end gap-2 md:w-auto md:min-w-75">
					{#if editing === 'storage'}
						<div in:slide class="flex w-full gap-2">
							<Input type="number" bind:value={editVal} class="bg-background" min="0" step="0.01" />
							<Select.Root type="single" bind:value={editUnit}>
								<Select.Trigger class="w-25">{editUnit}</Select.Trigger>
								<Select.Content>
									{#each Object.keys(B_VALS) as u}
										<Select.Item value={u} label={u}>{u}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex gap-2">
							<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
							<Button
								size="sm"
								onclick={() => {
									save({ total_storage_limit: bytesToNumber(editVal, editUnit) });
									editing = null;
								}}>Save</Button
							>
						</div>
					{:else}
						{@const f = formatBytes(configData.total_storage_limit)}
						<div
							class="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
						>
							<span class="font-mono font-medium">{f.val} {f.unit}</span>
						</div>
						<Button variant="outline" size="sm" onclick={() => startEdit('storage')}>Edit</Button>
					{/if}
				</Item.Actions>
			</Item.Root>

			<Item.Separator />

			<Item.Root>
				<Item.Content>
					<Item.Title>Max File Size</Item.Title>
					<Item.Description class="line-clamp-none text-wrap">
						The permissible size limit for a single file upload.
					</Item.Description>
				</Item.Content>
				<Item.Actions class="w-full flex-col items-end gap-2 md:w-auto md:min-w-75">
					{#if editing === 'file'}
						<div in:slide class="flex w-full gap-2">
							<Input type="number" bind:value={editVal} class="bg-background" min="0" step="0.01" />
							<Select.Root type="single" bind:value={editUnit}>
								<Select.Trigger class="w-25">{editUnit}</Select.Trigger>
								<Select.Content>
									{#each Object.keys(B_VALS) as u}
										<Select.Item value={u} label={u}>{u}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex gap-2">
							<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
							<Button
								size="sm"
								onclick={() => {
									save({ max_file_size_limit: bytesToNumber(editVal, editUnit) });
									editing = null;
								}}>Save</Button
							>
						</div>
					{:else}
						{@const f = formatBytes(configData.max_file_size_limit)}
						<div
							class="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
						>
							<span class="font-mono font-medium">{f.val} {f.unit}</span>
						</div>
						<Button variant="outline" size="sm" onclick={() => startEdit('file')}>Edit</Button>
					{/if}
				</Item.Actions>
			</Item.Root>
		</Item.Group>
	</Card.Content>
</Card.Root>
