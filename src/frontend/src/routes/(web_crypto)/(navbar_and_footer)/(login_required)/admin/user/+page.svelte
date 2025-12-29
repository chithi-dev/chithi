<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Avatar from '$lib/components/ui/avatar';
	import { LoaderCircle, User, Save, Image as ImageIcon } from 'lucide-svelte';
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
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen w-full flex-col">
	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
		<header class="flex items-center justify-between border-b border-border pb-4">
			<div class="flex items-center">
				<div class="rounded-xl border bg-background p-3 shadow-sm">
					<User class="size-6" />
				</div>
				<h1 class="ml-3 text-2xl font-bold md:text-xl">User Settings</h1>
			</div>
		</header>

		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<!-- Avatar Card -->
			<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<div class="flex items-center gap-2">
						<ImageIcon class="size-4 text-primary" />
						<Card.Title
							class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
							>Profile Picture</Card.Title
						>
					</div>
				</Card.Header>
				<Card.Content class="flex min-h-24 flex-col items-center justify-center py-6">
					<Avatar.Root class="h-32 w-32 shadow-xl">
						{#key hashedAvatar && username}
							<Avatar.Image src={hashedAvatar} alt="@{username}" />
						{/key}
						<Avatar.Fallback class="text-4xl">{initials}</Avatar.Fallback>
					</Avatar.Root>
					<p class="mt-6 text-center text-xs text-muted-foreground">
						Avatar provided by <a
							href="https://www.libravatar.org"
							target="_blank"
							class="underline hover:text-primary">Libravatar</a
						> based on your email.
					</p>
				</Card.Content>
			</Card.Root>

			<!-- Profile Form Card -->
			<Card.Root
				class="rounded-xl border bg-card text-card-foreground shadow-sm md:col-span-2 lg:col-span-2"
			>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<div class="flex items-center gap-2">
						<User class="size-4 text-primary" />
						<Card.Title
							class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
							>Account Details</Card.Title
						>
					</div>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleSubmit} class="mt-4 space-y-4">
						<div class="grid gap-2">
							<Label for="username">Username</Label>
							<Input id="username" bind:value={username} placeholder="Username" required />
						</div>
						<div class="grid gap-2">
							<Label for="email">Email</Label>
							<Input id="email" type="email" bind:value={email} placeholder="Email address" />
						</div>

						{#if error}
							<div in:fade class="text-sm text-destructive">{error}</div>
						{/if}
						{#if success}
							<div in:fade class="text-sm text-emerald-500">{success}</div>
						{/if}

						<div class="flex justify-end">
							<Button type="submit" disabled={loading}>
								{#if loading}
									<LoaderCircle class="mr-2 size-4 animate-spin" />
									Saving...
								{:else}
									<Save class="mr-2 size-4" />
									Save Changes
								{/if}
							</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</div>
	</main>
</div>
