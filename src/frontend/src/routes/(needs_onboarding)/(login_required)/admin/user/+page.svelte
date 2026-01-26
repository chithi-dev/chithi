<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { LoaderCircle } from 'lucide-svelte';
	import { useAuth } from '#queries/auth';
	import { fade } from 'svelte/transition';
	import { kebab_to_initials } from '#functions/string-conversion';
	import { make_libravatar_url } from '#functions/libravatar';
	import { Separator } from '$lib/components/ui/separator/index.js';
	const { user, updateUser } = useAuth();

	let username = $state('');
	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let initials = $derived(kebab_to_initials(username));
	let avatarBlobUrl = $state<string | null>(null);
	let isAvatarLoading = $state(false);

	$effect(() => {
		if (user.data) {
			username = user.data.username;
			email = user.data.email || '';
		}
	});

	$effect(() => {
		let active = true;
		let objectUrl: string | null = null;

		(async () => {
			if (!email) return;
			isAvatarLoading = true;
			try {
				const url = await make_libravatar_url(email);
				const res = await fetch(url);
				const blob = await res.blob();
				if (active) {
					objectUrl = URL.createObjectURL(blob);
					avatarBlobUrl = objectUrl;
				}
			} catch (err) {
				console.error('Failed to load avatar', err);
			} finally {
				if (active) {
					isAvatarLoading = false;
				}
			}
		})();

		return () => {
			active = false;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		success = null;

		try {
			await updateUser({
				username,
				email: email ? email : null
			});
			success = 'Profile updated successfully';
			// Clear success message after 3 seconds
			setTimeout(() => {
				success = null;
			}, 3000);
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen w-full bg-background">
	<div class="flex items-center justify-between border-b border-border px-6 py-4">
		<div>
			<h1 class="text-lg font-semibold">Personal Information</h1>
			<p class="text-sm text-muted-foreground">Manage your public profile and private details.</p>
		</div>
	</div>

	<Separator class="mb-10" />

	<Card.Root class="mx-auto h-full w-full max-w-4xl border shadow-sm">
		<Card.Content class="h-full p-0">
			<div class="flex h-full flex-col px-6 py-4">
				<form onsubmit={handleSubmit} class="flex-1 space-y-6">
					<!-- Avatar Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label class="text-base font-medium">Avatar</Label>
							<p class="text-sm text-muted-foreground">
								Your profile picture. Provided by Libravatar.
							</p>
						</div>
						<div class="flex w-full justify-start md:w-2/3 md:justify-start">
							{#if isAvatarLoading}
								<Skeleton class="h-16 w-16 rounded-full" />
							{:else}
								<Avatar.Root class="h-16 w-16 border bg-muted">
									<Avatar.Image src={avatarBlobUrl} alt="@{username}" />
									<Avatar.Fallback class="text-lg">{initials}</Avatar.Fallback>
								</Avatar.Root>
							{/if}
						</div>
					</div>

					<div class="h-px bg-border/50"></div>

					<!-- Username Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label for="username" class="text-base font-medium">Username</Label>
							<p class="text-sm text-muted-foreground">This is your public display name.</p>
						</div>
						<div class="w-full md:w-2/3">
							<Input id="username" bind:value={username} class="w-full bg-background" required />
						</div>
					</div>

					<div class="h-px bg-border/50"></div>

					<!-- Email Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label for="email" class="text-base font-medium">Email Address</Label>
							<p class="text-sm text-muted-foreground">Used for avatar and notifications.</p>
						</div>
						<div class="w-full md:w-2/3">
							<Input
								id="email"
								type="email"
								bind:value={email}
								class="w-full bg-background"
								placeholder="email@example.com"
							/>
						</div>
					</div>

					{#if error}
						<div in:fade class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					{/if}
					{#if success}
						<div in:fade class="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">
							{success}
						</div>
					{/if}

					<div class="flex justify-end pt-4">
						<Button type="submit" disabled={loading}>
							{#if loading}
								<LoaderCircle class="mr-2 size-4 animate-spin" />
								Saving...
							{:else}
								Save Changes
							{/if}
						</Button>
					</div>
				</form>
			</div>
		</Card.Content>
	</Card.Root>
</div>
