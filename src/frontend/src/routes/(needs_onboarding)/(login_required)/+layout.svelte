<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '#queries/auth';
	import { page } from '$app/state';
	import * as Empty from '$lib/components/ui/empty/index';
	import { LoaderCircle, Lock } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

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
	<div class="flex min-h-svh w-full flex-1 items-center justify-center p-4">
		<Empty.Root>
			<Empty.Header class="text-center">
				<Empty.Media
					variant="icon"
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
				>
					<Lock class="h-6 w-6 text-primary" />
				</Empty.Media>
				<Empty.Title class="text-2xl font-bold">Login Required</Empty.Title>
				<Empty.Description>Please sign in to access this protected area.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<div class="text-center text-sm text-muted-foreground">
					You are being redirected to the login page...
				</div>
				<div class="mt-4 flex w-full justify-center">
					<Button href={`/login?next=${page.url.pathname}`} class="w-full">Sign In</Button>
				</div>
			</Empty.Content>
		</Empty.Root>
	</div>
{:else}
	{@render children()}
{/if}
