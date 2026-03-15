<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, CircleAlert } from 'lucide-svelte';
	import { goto } from '$app/navigation';
</script>

<div class="flex min-h-[70vh] items-center justify-center p-4">
	<div class="max-w-md space-y-6 text-center">
		<div class="flex justify-center">
			<div class="rounded-full bg-destructive/10 p-4">
				<CircleAlert class="h-12 w-12 text-destructive" />
			</div>
		</div>
		<div class="space-y-2">
			<h2 class="text-3xl font-bold tracking-tight">Invalid Room</h2>
			<p class="text-lg text-muted-foreground">
				We couldn't find a valid room ID. The link might be broken or the room may have expired.
			</p>
		</div>
		<Button variant="outline" size="lg" onclick={() => goto('/reverse')} class="w-full sm:w-auto">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Reverse Share
		</Button>
	</div>
</div>
