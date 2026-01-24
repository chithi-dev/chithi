<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '#queries/auth';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Lock, LoaderCircle } from 'lucide-svelte';

	const { isAuthenticated, user: userData } = useAuth();

	let { children } = $props();

	$effect(() => {
		if (!isAuthenticated()) {
			goto(`/login?next=${page.url.pathname}`);
		}
	});
</script>

{#if userData.isLoading}
	<div class="flex w-full flex-1 items-center justify-center">
		<LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{:else if [null, undefined].includes(userData.data)}
	<div class="flex w-full flex-1 items-center justify-center p-4">
		<Card.Root class="w-full max-w-md shadow-lg">
			<Card.Header class="text-center">
				<div
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
				>
					<Lock class="h-6 w-6 text-primary" />
				</div>
				<Card.Title class="text-2xl font-bold">Login Required</Card.Title>
				<Card.Description>Please sign in to access this protected area.</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="text-center text-sm text-muted-foreground">
					You are being redirected to the login page...
				</div>
			</Card.Content>
			<Card.Footer class="flex justify-center">
				<Button href={`/login?next=${page.url.pathname}`} class="w-full">Sign In</Button>
			</Card.Footer>
		</Card.Root>
	</div>
{:else}
	{@render children()}
{/if}
