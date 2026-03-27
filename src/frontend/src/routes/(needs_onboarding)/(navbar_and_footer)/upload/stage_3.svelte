<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Lock, Check, Copy, Download, ScanEye, Eye } from 'lucide-svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index';
	import * as ButtonGroup from '$lib/components/ui/button-group';
	import { toast } from 'svelte-sonner';

	interface Props {
		finalLink: string;
		viewOnceLink: string;
		isViewOnce: boolean;
		onReset: () => void;
	}

	let { finalLink, viewOnceLink, isViewOnce, onReset }: Props = $props();

	let isCopied = $state(false);

	const copyLink = () => {
		navigator.clipboard.writeText(isViewOnce ? viewOnceLink : finalLink);
		isCopied = true;
		toast.success('Copied the link successfully');
		setTimeout(() => (isCopied = false), 2000);
	};
</script>

<div
	class="col-span-1 flex h-full flex-col items-center justify-center py-12 text-center lg:col-span-2"
>
	<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
		<Lock class="h-10 w-10 text-green-500" />
	</div>
	<h2 class="mb-2 text-3xl font-bold tracking-tight">
		{isViewOnce ? 'Your view-once link is ready' : 'Your file is encrypted and ready to send'}
	</h2>
	<p class="mb-8 text-muted-foreground">
		{isViewOnce ? 'This link can only be viewed once:' : 'Copy the link to share your file:'}
	</p>

	<div class="mb-8 flex w-full max-w-md items-center gap-2">
		<Input readonly value={isViewOnce ? viewOnceLink : finalLink} class="font-mono text-sm" />
	</div>

	<div class="mb-8 flex flex-col items-center gap-4">
		<div class="rounded-lg border bg-white p-2 dark:bg-white">
			<QRCode
				value={isViewOnce ? viewOnceLink : finalLink}
				size={180}
				color="#000000"
				backgroundColor="#ffffff"
			/>
		</div>
	</div>
	<div class="flex flex-col gap-4">
		<ButtonGroup.Root>
			<ButtonGroup.Root>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="outline" size="sm" onclick={copyLink} class="w-32 cursor-pointer">
								{#if isCopied}
									<Check class="mr-2 size-4" /> Copied
								{:else}
									<Copy class="mr-2 size-4" /> Copy link
								{/if}
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>Copy link to clipboard</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</ButtonGroup.Root>

			{#if isViewOnce}
				<ButtonGroup.Root>
					<Button
						variant="outline"
						size="icon-sm"
						href={viewOnceLink}
						class="cursor-pointer"
						aria-label="View once"
					>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<ScanEye class="size-4" />
								</Tooltip.Trigger>
								<Tooltip.Content>View once in browser</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Button>
				</ButtonGroup.Root>
			{:else}
				<ButtonGroup.Root>
					<Button
						variant="outline"
						class="cursor-pointer"
						size="icon-sm"
						href={finalLink}
						aria-label="Download"
					>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Download class="size-4" />
								</Tooltip.Trigger>
								<Tooltip.Content>Download file</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Button>

					<Button
						variant="outline"
						size="icon-sm"
						class="cursor-pointer"
						href={finalLink.replace('/download/', '/view/')}
						aria-label="View"
					>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<Eye class="size-4" />
								</Tooltip.Trigger>
								<Tooltip.Content>View file in browser</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Button>
				</ButtonGroup.Root>
			{/if}
		</ButtonGroup.Root>

		<Button variant="ghost" class="cursor-pointer" onclick={onReset}>Upload more files</Button>
	</div>
</div>
