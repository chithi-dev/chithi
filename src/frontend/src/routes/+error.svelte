<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { RefreshCw, ShieldAlert } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	let error = $derived(page.error);
	let status = $derived(page.status);

	function reload() {
		location.reload();
	}


</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-24 -left-24 h-125 w-125 rounded-full bg-red-500/10 blur-[120px] dark:bg-red-500/10"
		></div>
		<div
			class="absolute -right-24 -bottom-24 h-125 w-125 rounded-full bg-orange-500/10 blur-[120px] dark:bg-orange-500/10"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_90%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-md">
		<Card.Root
			class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-red-500/40 to-transparent"
			></div>

			<Card.Header class="space-y-3 pt-10 pb-8 text-center">
				<div
					class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500 shadow-sm ring-1 ring-red-200 dark:border-red-500/20 dark:bg-red-500/10 dark:ring-red-500/20"
				>
					<ShieldAlert class="size-8" />
				</div>
				<div class="space-y-1">
					<Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{#if status === 404}
							Page Not Found
						{:else if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
							Security Check Failed
						{:else}
							Something went wrong
						{/if}
					</Card.Title>
					<Card.Description class="text-sm text-slate-500 dark:text-zinc-400">
						{#if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
							Your environment is not secure enough.
						{:else if error?.message}
							{error.message}
						{:else}
							An unexpected error occurred.
						{/if}
					</Card.Description>
				</div>
			</Card.Header>

			<Card.Content class="text-center text-sm text-slate-600 dark:text-zinc-400">
				{#if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
					<p>
						This application requires the <strong>WebCrypto API</strong> to ensure your data remains secure.
					</p>
					<p class="mt-2">
						Please ensure you are using a modern browser and accessing this site via <strong
							>HTTPS</strong
						>.
					</p>
				{:else}
					<p>We encountered an error while processing your request. Please try again later.</p>
				{/if}
			</Card.Content>

			<Card.Footer
				class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 py-6 dark:border-zinc-800/50 dark:bg-zinc-950/40"
			>
				<Button class="w-full shadow-lg shadow-red-500/20 hover:bg-red-600" onclick={reload}>
					<RefreshCw class="mr-2 size-4" />
					Try Again
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
