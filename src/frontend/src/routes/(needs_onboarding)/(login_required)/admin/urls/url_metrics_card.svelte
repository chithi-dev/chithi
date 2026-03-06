<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Item from '$lib/components/ui/item';
	import { formatFileSize } from '#functions/bytes';

	let {
		totalUrls,
		timeToClearLabel,
		totalBytes,
		linksWithDownloadCaps,
		expiringSoon
	}: {
		totalUrls: number;
		timeToClearLabel: string;
		totalBytes: number;
		linksWithDownloadCaps: number;
		expiringSoon: number;
	} = $props();
</script>

<Card.Root class="border bg-background">
	<Card.Content class="p-6">
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<Item.Root variant="outline" class="gap-3">
				<Item.Content class="gap-0.5">
					<Item.Description class="line-clamp-none">Total URLs</Item.Description>
					<Item.Title class="text-xl">{totalUrls}</Item.Title>
				</Item.Content>
			</Item.Root>
			<Item.Root variant="outline" class="gap-3">
				<Item.Content class="gap-0.5">
					<Item.Description class="line-clamp-none">Time to Instance Clear</Item.Description>
					<Item.Title class="text-xl">{timeToClearLabel}</Item.Title>
				</Item.Content>
			</Item.Root>
			<Item.Root variant="outline" class="gap-3">
				<Item.Content class="gap-0.5">
					<Item.Description class="line-clamp-none">Total Size</Item.Description>
					<Item.Title class="text-xl">{formatFileSize(totalBytes)}</Item.Title>
				</Item.Content>
			</Item.Root>
			<Item.Root variant="outline" class="gap-3">
				<Item.Content class="gap-0.5">
					<Item.Description class="line-clamp-none">Links With Download Caps</Item.Description>
					<Item.Title class="text-xl">{linksWithDownloadCaps}</Item.Title>
					<Item.Description class="line-clamp-none text-xs">
						{expiringSoon} expiring in the next 24h
					</Item.Description>
				</Item.Content>
			</Item.Root>
		</div>
	</Card.Content>
</Card.Root>
