<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Upload, Download, ArrowLeft, LoaderCircle } from 'lucide-svelte';
	import { REVERSE_ROOMS_URL } from '#consts/backend';
	import { useConfigQuery } from '#queries/config';
	import { base64url } from '#functions/encryption';

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
			const res = await fetch(REVERSE_ROOMS_URL, {
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
			<h1 class="text-3xl font-bold tracking-tight">Reverse File Share</h1>
			<p class="text-muted-foreground">
				Host a room to push files to everyone - clients receive them in real time or download via a
				permanent link.
			</p>
		</div>

		{#if landingView === 'main'}
			<div class="grid gap-4 sm:grid-cols-2">
				<Card
					class="cursor-pointer transition-shadow hover:shadow-md"
					onclick={() => (landingView = 'create')}
				>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<Upload class="h-5 w-5" />
							Create a Room
						</CardTitle>
						<CardDescription>
							Host a room and share files. Guests receive them in real time via WebSocket.
						</CardDescription>
					</CardHeader>
				</Card>

				<Card
					class="cursor-pointer transition-shadow hover:shadow-md"
					onclick={() => (landingView = 'join')}
				>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<Download class="h-5 w-5" />
							Join a Room
						</CardTitle>
						<CardDescription>
							Enter a room ID or follow a shared link to receive files from the host.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		{:else if landingView === 'create'}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<Upload class="h-5 w-5" />
						Create a Room
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						<Label for="room-name">Room Name</Label>
						<Input
							id="room-name"
							placeholder="My share session"
							bind:value={roomName}
							onkeydown={(e) => e.key === 'Enter' && createRoom()}
						/>
					</div>
					<div class="space-y-2">
						<Label for="downloads">Number of downloads</Label>
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
						<p class="text-xs text-muted-foreground">
							Leave as "Use default" to apply server default.
						</p>
					</div>
					<div class="space-y-2">
						<Label for="expire">Expires after (seconds)</Label>
						<Input id="expire" type="number" min="60" max="86400" bind:value={expireAfter} />
						<p class="text-xs text-muted-foreground">
							{#if expireAfter >= 3600}
								{(expireAfter / 3600).toFixed(1)} hour(s)
							{:else}
								{Math.round(expireAfter / 60)} minute(s)
							{/if}
						</p>
					</div>
				</CardContent>
				<CardFooter class="flex gap-2">
					<Button variant="outline" onclick={() => (landingView = 'main')}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
					<Button onclick={createRoom} disabled={isCreating} class="flex-1">
						{#if isCreating}
							<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
							Creating…
						{:else}
							Create Room
						{/if}
					</Button>
				</CardFooter>
			</Card>
		{:else if landingView === 'join'}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<Download class="h-5 w-5" />
						Join a Room
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						<Label for="room-id">Room ID</Label>
						<Input
							id="room-id"
							placeholder="Paste room ID here"
							bind:value={joinId}
							onkeydown={(e) => e.key === 'Enter' && goJoin()}
						/>
					</div>
				</CardContent>
				<CardFooter class="flex gap-2">
					<Button variant="outline" onclick={() => (landingView = 'main')}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
					<Button onclick={goJoin} class="flex-1">Join Room</Button>
				</CardFooter>
			</Card>
		{/if}
	</div>
</div>
