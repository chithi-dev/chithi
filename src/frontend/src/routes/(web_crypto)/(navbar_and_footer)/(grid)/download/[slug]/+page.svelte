<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { FileText, Shield } from 'lucide-svelte';
</script>

<Card.Root class="relative z-10 w-[500px] border-border bg-card">
	<Card.Header class="text-center">
		<Card.Title class="text-2xl font-bold">Download files</Card.Title>
		<Card.Description class="text-muted-foreground">
			This file was shared via Send with end-to-end encryption and a link that automatically
			expires.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="flex items-center gap-4 rounded-lg border bg-background/50 p-4">
			<div class="rounded bg-blue-500/10 p-2 text-blue-500">
				<FileText class="h-6 w-6" />
			</div>
			<div class="flex-1 overflow-hidden">
				<p class="truncate font-medium">docker-compose.yml</p>
				<p class="text-xs text-muted-foreground">1.7KB</p>
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="flex flex-col gap-6">
		<Button class="w-full bg-blue-600 text-white hover:bg-blue-700" size="lg">Download</Button>
	</Card.Footer>
</Card.Root>
