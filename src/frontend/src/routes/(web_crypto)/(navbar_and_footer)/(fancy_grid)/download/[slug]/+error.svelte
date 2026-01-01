<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { KeyRound } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	let error = $derived(page.error);
</script>

<Card.Root class="relative z-10 mx-auto w-full max-w-5xl border-border bg-card">
	<Card.Content class="p-6">
		<div class="flex min-h-150 flex-col items-center justify-center">
			<div in:fly={{ y: 20, duration: 800 }} class="w-full max-w-lg">
				<Card.Header class="px-0 text-center">
					<div
						class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10"
					>
						<KeyRound class="h-10 w-10 text-destructive" />
					</div>
					<Card.Title class="text-2xl font-bold">Decryption Key Required</Card.Title>
					<Card.Description class="mt-2 text-muted-foreground">
						{(error as any)?.message || 'The decryption key is missing.'}
					</Card.Description>
				</Card.Header>
				<Card.Footer class="mt-6 flex w-full flex-col gap-6 px-0">
					<Button class="w-full cursor-pointer" variant="outline" href="/">Go Home</Button>
				</Card.Footer>
			</div>
		</div>
	</Card.Content>
</Card.Root>
