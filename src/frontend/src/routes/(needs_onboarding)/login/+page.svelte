<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { page } from '$app/state';
	import { ShieldCheck, ChevronLeft } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	import LoginForm from './login_form.svelte';
	import AnimatedGrid from '$lib/components/AnimatedGrid.svelte';
	import { validateRedirectUrl } from '$lib/functions/urls';

	const nextUrl = $derived.by(() => {
		const next = page.url.searchParams.get('next') ?? '/';
		try {
			const url = validateRedirectUrl(next, page.url.origin);
			if (url.startsWith('/admin')) {
				return '/';
			}
			return url;
		} catch {
			return '/';
		}
	});

	let { data } = $props();
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-card p-4 transition-colors duration-500"
>
	<AnimatedGrid />

	<a
		href={nextUrl}
		class="group absolute top-8 left-8 z-20 flex items-center gap-2 rounded-full border border-border bg-background/50 px-5 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-background hover:text-foreground"
	>
		<ChevronLeft class="size-4 transition-transform group-hover:-translate-x-1" />
		Back to {nextUrl}
	</a>

	<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-100">
		<Card
			class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
			></div>

			<CardHeader class="space-y-3 pt-10 pb-8 text-center">
				<div
					class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
				>
					<ShieldCheck class="size-8" />
				</div>
				<div class="space-y-1">
					<CardTitle class="text-2xl font-semibold tracking-tight text-foreground"
						>Admin Portal</CardTitle
					>
					<CardDescription class="text-sm text-muted-foreground">
						Enter your credentials to continue
					</CardDescription>
				</div>
			</CardHeader>

			<CardContent>
				<LoginForm {data} next_url={nextUrl} />
			</CardContent>

			<CardFooter
				class="flex items-center justify-center border-t border-border/50 bg-muted/50 py-6"
			>
				<p class="text-sm text-muted-foreground">
					Don't have an account?
					<a
						href="/signup"
						class="ml-1 font-semibold text-foreground transition-colors hover:text-primary"
					>
						Create an account
					</a>
				</p>
			</CardFooter>
		</Card>
	</div>
</div>
