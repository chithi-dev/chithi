<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="space-y-6">
	{#each Array(3) as _}
		<div class="rounded-xl border bg-card p-8">
			<div class="space-y-4">
				<Skeleton class="h-6 w-1/4" />
				<Skeleton class="h-4 w-1/2" />
				<div class="pt-4">
					<Skeleton class="h-10 w-full" />
				</div>
			</div>
		</div>
	{/each}
</div>
