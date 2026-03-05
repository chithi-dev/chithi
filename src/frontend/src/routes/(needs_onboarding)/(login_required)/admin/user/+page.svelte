<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Item from '$lib/components/ui/item';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { LoaderCircle } from 'lucide-svelte';
	import { useAuth } from '#queries/auth';
	import { fade } from 'svelte/transition';
	import { kebab_to_initials } from '#functions/string-conversion';
	import { make_libravatar_url } from '#functions/libravatar';

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

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<h2 class="text-3xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">Manage your public profile and private details.</p>
	</div>
</div>

<Card.Root class="border bg-background">
	<Card.Header class="px-6 py-4">
		<Card.Title class="text-base font-medium">Personal Information</Card.Title>
	</Card.Header>
	<Card.Content class="p-0">
		<form onsubmit={handleSubmit} class="space-y-0">
			<Item.Group>
				<Item.Root>
					<Item.Content>
						<Item.Title>Avatar</Item.Title>
						<Item.Description class="line-clamp-none">
							Your profile picture, fetched from Libravatar using your email.
						</Item.Description>
					</Item.Content>
					<Item.Actions class="w-full justify-start md:w-auto md:min-w-75 md:justify-end">
						{#if isAvatarLoading}
							<Skeleton class="h-16 w-16 rounded-full" />
						{:else}
							<Avatar.Root class="h-16 w-16 border bg-muted">
								<Avatar.Image src={avatarBlobUrl} alt="@{username}" />
								<Avatar.Fallback class="text-lg">{initials}</Avatar.Fallback>
							</Avatar.Root>
						{/if}
					</Item.Actions>
				</Item.Root>

				<Item.Separator />

				<Item.Root>
					<Item.Content>
						<Item.Title>Username</Item.Title>
						<Item.Description class="line-clamp-none"
							>This is your public display name.</Item.Description
						>
					</Item.Content>
					<Item.Actions class="w-full md:min-w-75">
						<Input id="username" bind:value={username} class="w-full bg-background" required />
					</Item.Actions>
				</Item.Root>

				<Item.Separator />

				<Item.Root>
					<Item.Content>
						<Item.Title>Email Address</Item.Title>
						<Item.Description class="line-clamp-none"
							>Used for avatar and notifications.</Item.Description
						>
					</Item.Content>
					<Item.Actions class="w-full md:min-w-75">
						<Input
							id="email"
							type="email"
							bind:value={email}
							class="w-full bg-background"
							placeholder="email@example.com"
						/>
					</Item.Actions>
				</Item.Root>
			</Item.Group>

			<div class="space-y-3 border-t p-4 md:p-6">
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

				<div class="flex justify-end">
					<Button type="submit" disabled={loading}>
						{#if loading}
							<LoaderCircle class="mr-2 size-4 animate-spin" />
							Saving...
						{:else}
							Save Changes
						{/if}
					</Button>
				</div>
			</div>
		</form>
	</Card.Content>
</Card.Root>
