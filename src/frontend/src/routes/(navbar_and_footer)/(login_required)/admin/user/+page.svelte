<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Avatar from '$lib/components/ui/avatar';
	import { LoaderCircle, Save } from 'lucide-svelte';
	import { useAuth } from '$lib/queries/auth';
	import { fade } from 'svelte/transition';
	import { kebab_to_initials } from '$lib/functions/string-conversion';
	import { make_libravatar_url } from '$lib/functions/libravatar';

	const { user, updateUser } = useAuth();

	let username = $state('');
	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let initials = $derived(kebab_to_initials(username));
	let hashedAvatar = $state<null | string>(null);

	$effect(() => {
		if (user.data) {
			username = user.data.username;
			email = user.data.email || '';
		}
	});

	$effect(() => {
		(async () => {
			hashedAvatar = await make_libravatar_url(email ?? '');
		})();
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

<div class="space-y-6">
	<Card.Root class="border shadow-sm">
		<Card.Header class="border-b bg-muted/20 px-6 py-4">
			<Card.Title class="text-base font-medium">Personal Information</Card.Title>
			<Card.Description>Manage your public profile and private details.</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			<div class="px-6 py-4">
				<form onsubmit={handleSubmit} class="space-y-6">
					<!-- Avatar Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label class="text-base font-medium">Avatar</Label>
							<p class="text-sm text-muted-foreground">
								Your profile picture. Provided by Libravatar.
							</p>
						</div>
						<div class="flex w-full justify-start md:w-auto md:min-w-75 md:justify-start">
							<Avatar.Root class="h-16 w-16 border bg-muted">
								{#key hashedAvatar && username}
									<Avatar.Image src={hashedAvatar} alt="@{username}" />
								{/key}
								<Avatar.Fallback class="text-lg">{initials}</Avatar.Fallback>
							</Avatar.Root>
						</div>
					</div>

					<div class="h-px bg-border/50"></div>

					<!-- Username Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label for="username" class="text-base font-medium">Username</Label>
							<p class="text-sm text-muted-foreground">This is your public display name.</p>
						</div>
						<div class="w-full md:w-auto md:min-w-75">
							<Input
								id="username"
								bind:value={username}
								class="max-w-75 bg-background"
								required
							/>
						</div>
					</div>

					<div class="h-px bg-border/50"></div>

					<!-- Email Row -->
					<div class="flex flex-col gap-4 py-2 md:flex-row md:items-start md:justify-between">
						<div class="space-y-1 md:w-1/2">
							<Label for="email" class="text-base font-medium">Email Address</Label>
							<p class="text-sm text-muted-foreground">Used for avatar and notifications.</p>
						</div>
						<div class="w-full md:w-auto md:min-w-75">
							<Input
								id="email"
								type="email"
								bind:value={email}
								class="max-w-75 bg-background"
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
