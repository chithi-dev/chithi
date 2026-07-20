<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Upload, Download, ArrowLeft } from '@lucide/svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Api } from '#consts/backend';
	import { useConfigQuery } from '#queries/config';
	import { base64url } from '#functions/encryption';
	import { H1, P } from '$lib/components/ui/typography/index.js';

	type LandingView = 'main' | 'create' | 'join';
	let landingView = $state<LandingView>('main');

	let roomName = $state('');
	let expireAfter = $state(3600);
	// empty string means "use server default"
	let numberOfDownloads = $state('');
	let joinId = $state('');
	let isCreating = $state(false);

	const { config: configData } = useConfigQuery();
	let defaultDownloadLimitSet = $state(false);

	$effect(() => {
		if (configData.data?.default_number_of_downloads && !defaultDownloadLimitSet) {
			numberOfDownloads = configData.data.default_number_of_downloads.toString();
			defaultDownloadLimitSet = true;
		}
	});

	$effect(() => {
		const prefilledId = page.url.searchParams.get('join');
		if (prefilledId) {
			joinId = prefilledId;
			landingView = 'join';
		}
	});

	async function createRoom() {
		if (!roomName.trim()) {
			toast.error('Please enter a room name');
			return;
		}
		isCreating = true;
		try {
			const res = await fetch(Api.REVERSE.ROOMS, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: roomName.trim(),
					expire_after: expireAfter,
					number_of_downloads: numberOfDownloads === '' ? null : Number(numberOfDownloads)
				}),
				credentials: 'include'
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
			}
			const data = (await res.json()) as { id: string; host_token: string };
			const roomKeyBytes = crypto.getRandomValues(new Uint8Array(32));
			const roomKey = base64url(roomKeyBytes);
			goto(`/reverse/${data.id}#${data.host_token}:${roomKey}`);
		} catch (e: unknown) {
			toast.error(`Failed to create room: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			isCreating = false;
		}
	}

	function goJoin() {
		const id = joinId.trim();
		if (!id) {
			toast.error('Please enter a room ID');
			return;
		}
		goto(`/reverse/${id}`);
	}
</script>

<div class="flex min-h-[70vh] items-center justify-center p-4">
	<div class="w-full max-w-2xl space-y-6">
		<div class="space-y-1 text-center">
			<H1>Reverse File Share</H1>
			<P class="text-muted-foreground">
				Host a room to push files to everyone - clients receive them in real time or download via a
				permanent link.
			</P>
		</div>

		{#if landingView === 'main'}
			<div class="grid gap-4 sm:grid-cols-2">
				<Card.Root
					class="cursor-pointer transition-shadow hover:shadow-md"
					onclick={() => (landingView = 'create')}
				>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Upload class="h-5 w-5" />
							Create a Room
						</Card.Title>
						<Card.Description>
							Host a room and share files. Guests receive them in real time via WebSocket.
						</Card.Description>
					</Card.Header>
				</Card.Root>

				<Card.Root
					class="cursor-pointer transition-shadow hover:shadow-md"
					onclick={() => (landingView = 'join')}
				>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Download class="h-5 w-5" />
							Join a Room
						</Card.Title>
						<Card.Description>
							Enter a room ID or follow a shared link to receive files from the host.
						</Card.Description>
					</Card.Header>
				</Card.Root>
			</div>
		{:else if landingView === 'create'}
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Upload class="h-5 w-5" />
						Create a Room
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<Field.Field class="space-y-2">
						<Field.Label>Room Name</Field.Label>
						<Field.Content>
							<Input
								placeholder="My share session"
								bind:value={roomName}
								onkeydown={(e) => e.key === 'Enter' && createRoom()}
							/>
						</Field.Content>
					</Field.Field>
					<Field.Field class="space-y-2">
						<Field.Label>Number of downloads</Field.Label>
						<Field.Content>
							<Select.Root type="single" bind:value={numberOfDownloads}>
								<Select.Trigger class="w-full">
									{numberOfDownloads === ''
										? 'Use default'
										: `${numberOfDownloads} ${numberOfDownloads === '1' ? 'download' : 'downloads'}`}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">Use default</Select.Item>
									{#if configData.data?.download_configs}
										{#each configData.data.download_configs as limit}
											<Select.Item value={limit.toString()}
												>{limit} {limit === 1 ? 'download' : 'downloads'}</Select.Item
											>
										{/each}
									{:else}
										<Select.Item value="1">1 download</Select.Item>
									{/if}
								</Select.Content>
							</Select.Root>
						</Field.Content>
						<Field.Description class="text-xs text-muted-foreground">
							Leave as "Use default" to apply server default.
						</Field.Description>
					</Field.Field>
					<Field.Field class="space-y-2">
						<Field.Label>Expires after (seconds)</Field.Label>
						<Field.Content>
							<Input type="number" min="60" max="86400" bind:value={expireAfter} />
						</Field.Content>
						<Field.Description class="text-xs text-muted-foreground">
							{#if expireAfter >= 3600}
								{(expireAfter / 3600).toFixed(1)} hour(s)
							{:else}
								{Math.round(expireAfter / 60)} minute(s)
							{/if}
						</Field.Description>
					</Field.Field>
				</Card.Content>
				<Card.Footer class="flex gap-2">
					<Button variant="outline" onclick={() => (landingView = 'main')}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
					<Button onclick={createRoom} disabled={isCreating} class="flex-1">
						{#if isCreating}
							<Spinner />
							Creating…
						{:else}
							Create Room
						{/if}
					</Button>
				</Card.Footer>
			</Card.Root>
		{:else if landingView === 'join'}
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Download class="h-5 w-5" />
						Join a Room
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<Field.Field class="space-y-2">
						<Field.Label>Room ID</Field.Label>
						<Field.Content>
							<Input
								placeholder="Paste room ID here"
								bind:value={joinId}
								onkeydown={(e) => e.key === 'Enter' && goJoin()}
							/>
						</Field.Content>
					</Field.Field>
				</Card.Content>
				<Card.Footer class="flex gap-2">
					<Button variant="outline" onclick={() => (landingView = 'main')}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
					<Button onclick={goJoin} class="flex-1">Join Room</Button>
				</Card.Footer>
			</Card.Root>
		{/if}
	</div>
</div>
