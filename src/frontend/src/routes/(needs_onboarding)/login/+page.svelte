<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { page } from '$app/state';
	import {
		ShieldCheck,
		ArrowRight,
		Mail,
		Lock,
		LoaderCircle,
		ChevronLeft,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils';
	import { useAuth } from '$lib/queries/auth';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	// States
	let isLoading = $state(false);
	let showPassword = $state(false);
	let email = $state('');
	let password = $state('');

	const { login } = useAuth();
	const isPasswordEmpty = $derived(password.length === 0);

	// Next url
	const nextUrl = $derived(page.url.searchParams.get('next') ?? '/');

	// Auto-hide password text if the input is cleared
	$effect(() => {
		if (isPasswordEmpty) {
			showPassword = false;
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		try {
			const token = await login(email, password);
			if (token) {
				goto(nextUrl);
			}
		} catch (e) {
			if (e instanceof Error) {
				toast.error(e.message);
			}
		}
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-24 -left-24 h-125 w-125 rounded-full bg-blue-500/10 blur-[120px] dark:bg-primary/20"
		></div>
		<div
			class="absolute -right-24 -bottom-24 h-125 w-125 rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-500/10"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_90%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<a
		href={nextUrl}
		class="group absolute top-8 left-8 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/50 px-5 py-2 text-xs font-medium text-slate-500 backdrop-blur-md transition-all hover:border-primary/50 hover:bg-white hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900/80 dark:hover:text-white"
	>
		<ChevronLeft class="size-4 transition-transform group-hover:-translate-x-1" />
		Back to {nextUrl}
	</a>

	<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-100">
		<Card.Root
			class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
			></div>

			<Card.Header class="space-y-3 pt-10 pb-8 text-center">
				<div
					class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-primary shadow-sm ring-1 ring-blue-200 dark:border-primary/20 dark:bg-primary/10 dark:ring-primary/20"
				>
					<ShieldCheck class="size-8" />
				</div>
				<div class="space-y-1">
					<Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
						>Admin Portal</Card.Title
					>
					<Card.Description class="text-sm text-slate-500 dark:text-zinc-400">
						Enter your credentials to continue
					</Card.Description>
				</div>
			</Card.Header>

			<Card.Content>
				<form onsubmit={handleSubmit} class="grid gap-6">
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="email" class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
								>Email or Username</Label
							>
							<div class="group relative">
								<div
									class="absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-primary dark:text-zinc-500"
								>
									<Mail class="size-4" />
								</div>
								<Input
									id="email"
									bind:value={email}
									placeholder="name@example.com"
									class="h-12 border-slate-200 bg-white/50 pl-11 transition-all focus-visible:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950/50"
									required
								/>
							</div>
						</div>

						<div class="grid gap-2">
							<div class="flex items-center px-1">
								<Label for="password" class="text-sm font-medium text-slate-700 dark:text-zinc-400"
									>Password</Label
								>
							</div>
							<div class="group relative">
								<div
									class="absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-primary dark:text-zinc-500"
								>
									<Lock class="size-4" />
								</div>
								<Input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									class="h-12 border-slate-200 bg-white/50 px-11 transition-all focus-visible:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950/50"
									required
								/>

								<Button
									variant="ghost"
									size="icon"
									type="button"
									onclick={() => (showPassword = !showPassword)}
									disabled={isPasswordEmpty}
									class={cn(
										'absolute top-1 right-1 h-10 w-10 text-slate-400 transition-all duration-200 dark:text-zinc-500',
										isPasswordEmpty && 'pointer-events-none scale-90 opacity-0',
										!isPasswordEmpty &&
											'scale-100 opacity-100 hover:bg-transparent hover:text-slate-900 dark:hover:text-white'
									)}
								>
									{#if showPassword}
										<EyeOff class="size-4" />
									{:else}
										<Eye class="size-4" />
									{/if}
								</Button>
							</div>
						</div>
					</div>

					<Button
						type="submit"
						disabled={isLoading}
						class="h-12 w-full font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
					>
						{#if isLoading}
							<LoaderCircle class="mr-2 size-5 animate-spin" />
							Authenticating
						{:else}
							Sign In
							<ArrowRight class="ml-2 size-5 transition-transform group-hover:translate-x-1" />
						{/if}
					</Button>
				</form>
			</Card.Content>

			<Card.Footer
				class="flex items-center justify-center border-t border-slate-100 bg-slate-50/50 py-6 dark:border-zinc-800/50 dark:bg-zinc-950/40"
			>
				<p class="text-sm text-slate-500 dark:text-zinc-500">
					Don't have an account?
					<a
						href="/signup"
						class="ml-1 font-semibold text-slate-900 transition-colors hover:text-primary dark:text-white dark:hover:text-primary"
					>
						Create an account
					</a>
				</p>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
